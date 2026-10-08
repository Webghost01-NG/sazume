import { describe, expect, it } from "vitest";
import { defineIntent } from "../packages/core/src/intent.js";
import { ArcObserver } from "../packages/arc/src/observer.js";
import { native18ToUsdc6 } from "../packages/arc/src/normalization.js";
import type { Address } from "viem";
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics } from "viem";
import { intentSettledEvent } from "../packages/arc/src/observer.js";
import { ArcEconomicAdapter } from "../packages/arc/src/adapter.js";
import { arcConfigFromEnv } from "../packages/arc/src/config.js";
import { arcChain } from "../packages/arc/src/client.js";
import { assertArcMainnetWritePlan, type ArcMainnetWritePlan } from "../packages/arc/src/preflight.js";

const payer = "0x00000000000000000000000000000000000000aa" as const;
const recipient = "0x00000000000000000000000000000000000000bb" as const;
const contract = "0x00000000000000000000000000000000000000cc" as const;
const intent = defineIntent({ id: "ORDER-7F21", payment: { payer: "customer", recipient: "merchant", asset: { symbol: "USDC", decimals: 6 }, amount: 1_000_000n }, invariants: [] });

describe("Arc unit normalization", () => {
  it("normalizes zero, one USDC, and sub-USDC amounts using integer arithmetic", () => {
    expect(native18ToUsdc6(0n)).toBe(0n);
    expect(native18ToUsdc6(1_000_000_000_000_000_000n)).toBe(1_000_000n);
    expect(native18ToUsdc6(123_456_789_012_345_678n)).toBe(123_456n);
  });
  it("truncates below one USDC6 unit without rounding and rejects negative cost", () => {
    expect(native18ToUsdc6(999_999_999_999n)).toBe(0n);
    expect(native18ToUsdc6(1_999_999_999_999n)).toBe(1n);
    expect(() => native18ToUsdc6(-1n)).toThrow();
    expect(typeof native18ToUsdc6(1_000_000_000_000n)).toBe("bigint");
  });
});

describe("Arc network configuration", () => {
  it("uses official Arc testnet configuration and refuses mainnet during Phase 6.5", () => {
    const addresses = { ARC_USDC_ADDRESS: "0x3600000000000000000000000000000000000000", SAZUME_SETTLEMENT_ADDRESS: "0x0000000000000000000000000000000000000001" };
    const testnet = arcConfigFromEnv(addresses);
    expect(testnet).toMatchObject({ chainId: 5_042_002, rpcUrl: "https://rpc.testnet.arc.io" });
    expect(arcChain(testnet)).toMatchObject({ id: 5_042_002, nativeCurrency: { symbol: "USDC", decimals: 18 } });
    expect(() => arcConfigFromEnv({ ...addresses, ARC_CHAIN_ID: "5042" })).toThrow("MAINNET EXECUTION DISABLED DURING PHASE 6.5");
    expect(() => arcChain({ ...testnet, chainId: 5042 })).toThrow("MAINNET EXECUTION DISABLED DURING PHASE 6.5");
    expect(() => arcConfigFromEnv({ ...addresses, ARC_CHAIN_ID: "1" })).toThrow();
  });
});

function makeLog(intentId: `0x${string}`, amount: bigint, from: Address = payer, to: Address = recipient, address: Address = contract, transactionHash = `0x${"1".repeat(64)}` as const) {
  return {
    address,
    topics: encodeEventTopics({ abi: [intentSettledEvent], args: { intentId, payer: from, recipient: to } }),
    data: encodeAbiParameters([{ type: "uint256" }], [amount]),
    transactionHash,
    blockNumber: 2n,
    blockHash: `0x${"2".repeat(64)}` as const,
    logIndex: 0,
    transactionIndex: 0,
    removed: false,
  };
}

describe("ArcObserver", () => {
  it("derives one settlement and exact recipient amount from matching event evidence", async () => {
    const getLogs = async () => [makeLog(`0x${intent.intentId}`, 1_000_000n)];
    const client = { getLogs, getTransactionReceipt: async () => ({ status: "success", gasUsed: 21_000n, effectiveGasPrice: 3n }) } as never;
    const observer = new ArcObserver(client as never, contract, 1n, () => payer, () => recipient);
    const result = await observer.observe(intent, 1, true, []);
    expect(result.outcome.settlement).toEqual({ count: 1, totalAmount: 1_000_000n });
    expect(result.outcome.fulfillment.count).toBe(1);
    expect(result.outcome.completed).toBe(true);
    expect(result.transactions[0]?.gasCostNative18).toBe(63_000n);
  });
  it("counts duplicate same-intent events and ignores unrelated parties", async () => {
    const otherIntent = `0x${"f".repeat(64)}` as const;
    const getLogs = async () => [makeLog(`0x${intent.intentId}`, 1_000_000n), makeLog(`0x${intent.intentId}`, 1_000_000n), makeLog(`0x${intent.intentId}`, 50n, payer, "0x00000000000000000000000000000000000000dd"), makeLog(otherIntent, 99n)];
    const observer = new ArcObserver({ getLogs, getTransactionReceipt: async () => ({ status: "success", gasUsed: 1n, effectiveGasPrice: 1n }) } as never, contract, 1n, () => payer, () => recipient);
    const result = await observer.observe(intent, 0, false, []);
    expect(result.outcome.settlement).toEqual({ count: 2, totalAmount: 2_000_000n });
  });
  it("does not count reverted attempts without successful IntentSettled evidence", async () => {
    const observer = new ArcObserver({ getLogs: async () => [] } as never, contract, 1n, () => payer, () => recipient);
    const transactions = [{ hash: `0x${"2".repeat(64)}` as const, status: "reverted" as const, gasUsed: 30_000n, effectiveGasPrice: 20_000_000_000n, gasCostNative18: 600_000_000_000_000n }];
    const result = await observer.observe(intent, 0, false, transactions);
    expect(result.outcome.settlement).toEqual({ count: 0, totalAmount: 0n });
    expect(result.transactions).toEqual(transactions);
    expect(result.transactions[0]?.gasCostNative18).toBe(600_000_000_000_000n);
  });
  it("rejects a matching event if its transaction receipt is reverted", async () => {
    const observer = new ArcObserver({ getLogs: async () => [makeLog(`0x${intent.intentId}`, 1_000_000n)], getTransactionReceipt: async () => ({ status: "reverted", gasUsed: 30_000n, effectiveGasPrice: 20_000_000_000n }) } as never, contract, 1n, () => payer, () => recipient);
    const result = await observer.observe(intent, 0, false, []);
    expect(result.outcome.settlement).toEqual({ count: 0, totalAmount: 0n });
    expect(result.transactions).toEqual([]);
  });
});

describe("ArcEconomicAdapter boundary", () => {
  it("submits the same intent ID on retries, counts only successful contract evidence, and resets isolation", async () => {
    const fixtureA = "0x00000000000000000000000000000000000000c1" as Address;
    const fixtureB = "0x00000000000000000000000000000000000000c2" as Address;
    const fixtureC = "0x00000000000000000000000000000000000000c3" as Address;
    let activeFixture = fixtureA;
    const firstHash = `0x${"a".repeat(64)}` as const;
    const secondHash = `0x${"b".repeat(64)}` as const;
    const hashes: typeof firstHash[] = [];
    const submitted: `0x${string}`[] = [];
    let receiptIndex = 0;
    const publicClient = {
      chain: { id: 31337 },
      estimateFeesPerGas: async () => ({ maxFeePerGas: 10n, maxPriorityFeePerGas: 1n }),
      waitForTransactionReceipt: async ({ hash }: { hash: typeof firstHash }) => ({ hash, status: receiptIndex++ === 0 ? "success" : "reverted", gasUsed: 21_000n, effectiveGasPrice: 2n, blockNumber: BigInt(receiptIndex) }),
      getTransactionReceipt: async () => ({ status: "success", gasUsed: 21_000n, effectiveGasPrice: 2n }),
      getLogs: async ({ address }: { address: Address }) => address === activeFixture && activeFixture === fixtureB ? [makeLog(`0x${intent.intentId}`, 1_000_000n, payer, recipient, fixtureB, firstHash)] : [],
    };
    const walletClient = { account: payer, chain: { id: 31337 }, sendTransaction: async ({ data }: { data: `0x${string}` }) => {
      submitted.push(data);
      const hash = hashes.length === 0 ? firstHash : secondHash;
      hashes.push(hash);
      return hash;
    } };
    const adapter = new ArcEconomicAdapter({
      publicClient: publicClient as never,
      walletClient: walletClient as never,
      contractAddress: fixtureA,
      payerFor: () => payer,
      recipientFor: () => recipient,
      idempotentFulfillment: true,
      fromBlock: 1n,
      resetForScenario: async () => { activeFixture = activeFixture === fixtureA ? fixtureB : fixtureC; return { contractAddress: activeFixture, fromBlock: 1n }; },
    });
    await adapter.reset();
    expect((await adapter.settle(intent)).accepted).toBe(true);
    expect((await adapter.settle(intent)).accepted).toBe(false);
    const settleAbi = [{ type: "function", name: "settle", stateMutability: "nonpayable", inputs: [{ name: "intentId", type: "bytes32" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }] as const;
    expect(submitted.map((data) => decodeFunctionData({ abi: settleAbi, data }).args[0])).toEqual([`0x${intent.intentId}`, `0x${intent.intentId}`]);
    await adapter.fulfill(intent);
    await adapter.fulfill(intent);
    const observed = await adapter.observe(intent);
    expect(observed.settlement).toEqual({ count: 1, totalAmount: 1_000_000n });
    expect(observed.fulfillment.count).toBe(1);
    await adapter.reset();
    expect((await adapter.observe(intent)).settlement.count).toBe(0);
    expect((await adapter.observeWithExecution(intent)).transactions).toEqual([]);
  });

  it("blocks mainnet and refuses Arc Testnet RPC chain mismatches before sending", async () => {
    let sendCount = 0;
    const mainnetAdapter = new ArcEconomicAdapter({
      publicClient: { chain: { id: 5_042 } } as never,
      walletClient: { chain: { id: 5_042 }, account: payer, sendTransaction: async () => { sendCount += 1; return `0x${"a".repeat(64)}`; } } as never,
      contractAddress: contract, payerFor: () => payer, recipientFor: () => recipient,
      idempotentFulfillment: true, fromBlock: 0n,
      resetForScenario: async () => ({ contractAddress: contract, fromBlock: 0n }),
    });
    await expect(mainnetAdapter.settle(intent)).rejects.toThrow("MAINNET EXECUTION DISABLED DURING PHASE 6.5");

    const mismatchedTestnetAdapter = new ArcEconomicAdapter({
      publicClient: { chain: { id: 5_042_002 }, getChainId: async () => 5042 } as never,
      walletClient: { chain: { id: 5_042_002 }, account: payer, sendTransaction: async () => { sendCount += 1; return `0x${"b".repeat(64)}`; } } as never,
      contractAddress: contract, payerFor: () => payer, recipientFor: () => recipient,
      idempotentFulfillment: true, fromBlock: 0n,
      resetForScenario: async () => ({ contractAddress: contract, fromBlock: 0n }),
    });
    await expect(mismatchedTestnetAdapter.settle(intent)).rejects.toThrow("Arc Testnet chain guard rejected RPC chain ID 5042; expected 5042002");
    expect(sendCount).toBe(0);
  });

  it("rejects an absent signer before fee estimation or transaction submission", async () => {
    let estimatedFees = 0;
    let sendCount = 0;
    const adapter = new ArcEconomicAdapter({
      publicClient: {
        chain: { id: 5_042_002 },
        getChainId: async () => 5_042_002,
        estimateFeesPerGas: async () => { estimatedFees += 1; return { maxFeePerGas: 20n, maxPriorityFeePerGas: 1n }; },
      } as never,
      walletClient: { chain: { id: 5_042_002 }, sendTransaction: async () => { sendCount += 1; return `0x${"c".repeat(64)}`; } } as never,
      contractAddress: contract,
      payerFor: () => payer,
      recipientFor: () => recipient,
      idempotentFulfillment: true,
      fromBlock: 0n,
      resetForScenario: async () => ({ contractAddress: contract, fromBlock: 0n }),
    });
    await expect(adapter.settle(intent)).rejects.toThrow("Arc settlement requires an explicitly configured signer");
    expect(estimatedFees).toBe(0);
    expect(sendCount).toBe(0);
  });
});

describe("Arc Mainnet spend preflight", () => {
  const plan: ArcMainnetWritePlan = {
    explicitOptIn: true,
    actualChainId: 5_042,
    rpcUrl: "https://rpc.mainnet.arc.io",
    approvedRpcUrl: "https://rpc.mainnet.arc.io",
    selectedSignerAddress: payer,
    approvedSignerAddress: payer,
    plannedTransactions: 8,
    maximumTransactions: 8,
    principalUsdc6: 30_000n,
    maximumPrincipalUsdc6: 30_000n,
    gasExposureNative18: 62_829_520_000_000_000n,
    maximumGasExposureNative18: 62_829_520_000_000_000n,
    maximumTotalExposureNative18: 92_829_520_000_000_000n,
  };

  it("accepts a bounded, explicitly approved plan without signing or broadcasting", () => {
    expect(() => assertArcMainnetWritePlan(plan)).not.toThrow();
  });

  it("rejects missing opt-in, wrong chain, and unapproved RPC endpoints", () => {
    expect(() => assertArcMainnetWritePlan({ ...plan, explicitOptIn: false })).toThrow("explicit opt-in");
    expect(() => assertArcMainnetWritePlan({ ...plan, actualChainId: 5_042_002 })).toThrow("expected chain ID 5042");
    expect(() => assertArcMainnetWritePlan({ ...plan, rpcUrl: "https://rpc.testnet.arc.io" })).toThrow("does not match");
  });

  it("rejects a missing or different signer", () => {
    expect(() => assertArcMainnetWritePlan({ ...plan, selectedSignerAddress: undefined })).toThrow("explicitly selected signer");
    expect(() => assertArcMainnetWritePlan({ ...plan, approvedSignerAddress: "0x0000000000000000000000000000000000000001" })).toThrow("does not match");
  });

  it("rejects transaction count, principal, gas, and combined exposure overruns", () => {
    expect(() => assertArcMainnetWritePlan({ ...plan, plannedTransactions: 9 })).toThrow("transaction count exceeds");
    expect(() => assertArcMainnetWritePlan({ ...plan, principalUsdc6: 30_001n })).toThrow("principal exceeds");
    expect(() => assertArcMainnetWritePlan({ ...plan, gasExposureNative18: plan.maximumGasExposureNative18 + 1n })).toThrow("gas exposure exceeds");
    expect(() => assertArcMainnetWritePlan({ ...plan, maximumTotalExposureNative18: 92_829_519_999_999_999n })).toThrow("Total Mainnet exposure exceeds");
  });
});
