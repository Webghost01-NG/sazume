import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { defineIntent, fulfillmentUniqueness, recipientAmount, report, sazume, settlementUniqueness, completionConsistency } from "../../core/src/index.js";
import { duplicateCallback } from "../../../scenarios/duplicate-callback.js";
import { normal } from "../../../scenarios/normal.js";
import { timeoutAfterSettlement } from "../../../scenarios/timeout-after-settlement.js";
import { timeoutBeforeSettlement } from "../../../scenarios/timeout-before-settlement.js";
import { ArcEconomicAdapter } from "./adapter.js";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, type Address, type Hex } from "viem";

const arcFoundryLocal = process.env.SAZUME_ARC_FOUNDRY_LOCAL === "1";
const rpcUrl = "http://127.0.0.1:8547";
const chainId = arcFoundryLocal ? 5_042_002 : 31_337;
const localChain = defineChain({ id: chainId, name: arcFoundryLocal ? "Arc Foundry arc-anvil local simulation (not Arc Testnet)" : "Ordinary Anvil Local EVM (not Arc)", nativeCurrency: { name: "Local simulation currency", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
const deployer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address;
const payer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
const recipient = deployer;
const usdcAbi = parseAbi(["function mint(address to,uint256 amount)", "function approve(address spender,uint256 amount) returns (bool)"]);

const publicClient = createPublicClient({ chain: localChain, transport: http(rpcUrl) });
const deployWallet = createWalletClient({ account: deployer, chain: localChain, transport: http(rpcUrl) });
const payerWallet = createWalletClient({ account: payer, chain: localChain, transport: http(rpcUrl) });
let child: ChildProcess | undefined;

async function deployArtifact(file: string, args: readonly unknown[] = []): Promise<Address> {
  const artifact = JSON.parse(await readFile(new URL(`../../../contracts/out/${file}`, import.meta.url), "utf8")) as { abi: readonly unknown[]; bytecode: { object: string } };
  const bytecode = artifact.bytecode.object.startsWith("0x") ? artifact.bytecode.object : `0x${artifact.bytecode.object}`;
  const hash = await deployWallet.deployContract({ account: deployer, abi: artifact.abi, bytecode: bytecode as Hex, args } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`Deployment failed: ${file}`);
  return receipt.contractAddress;
}

async function sendAndWait(hash: Hex): Promise<void> { await publicClient.waitForTransactionReceipt({ hash }); }

async function startAnvil(): Promise<void> {
  const executable = arcFoundryLocal ? (process.env.ARC_ANVIL_BIN ?? "arc-anvil") : "anvil";
  const args = ["--port", "8547", "--chain-id", String(chainId), "--accounts", "5", "--silent"];
  if (arcFoundryLocal) args.push("--block-base-fee-per-gas", "20000000000");
  child = spawn(executable, args, { stdio: "ignore" });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await publicClient.getChainId(); return; } catch { await delay(100); }
  }
  throw new Error("Local Anvil did not start on port 8547");
}

async function main(): Promise<void> {
  await startAnvil();
  const actualChainId = await publicClient.getChainId();
  if (actualChainId !== chainId) throw new Error(`Local execution chain ID mismatch: expected ${chainId}, got ${actualChainId}`);
  const token = await deployArtifact("MockUSDC.sol/MockUSDC.json");
  await sendAndWait(await deployWallet.writeContract({ address: token, abi: usdcAbi, functionName: "mint", args: [payer, 100_000_000n] }));
  const intent = defineIntent({
    id: "ORDER-7F21",
    payment: { payer: "customer", recipient: "merchant", asset: { symbol: "USDC", decimals: 6 }, amount: 1_000_000n },
    invariants: [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()],
  });
  const scenarios = [normal(), timeoutBeforeSettlement(), timeoutAfterSettlement(), duplicateCallback()];
  for (const [label, artifactPath, idempotent] of [
    ["UNSAFE", "UnsafeSettlement.sol/UnsafeSettlement.json", false],
    ["FIXED", "IdempotentSettlement.sol/IdempotentSettlement.json", true],
  ] as const) {
    const initialContract = await deployArtifact(artifactPath, [token]);
    await sendAndWait(await payerWallet.writeContract({ address: token, abi: usdcAbi, functionName: "approve", args: [initialContract, 100_000_000n] }));
    const adapter = new ArcEconomicAdapter({
      publicClient, walletClient: payerWallet, contractAddress: initialContract,
      payerFor: () => payer, recipientFor: () => recipient, idempotentFulfillment: idempotent,
      fromBlock: await publicClient.getBlockNumber(),
      resetForScenario: async () => {
        const isolated = await deployArtifact(artifactPath, [token]);
        await sendAndWait(await payerWallet.writeContract({ address: token, abi: usdcAbi, functionName: "approve", args: [isolated, 100_000_000n] }));
        return { contractAddress: isolated, fromBlock: await publicClient.getBlockNumber() };
      },
    });
    const result = await sazume.run({ intent, adapter, scenarios });
    console.log(`EXECUTION ENVIRONMENT: ${localChain.name} (chain ID ${localChain.id})`);
    console.log(report(result, `${label} ONCHAIN FIXTURE`));
    const histories = adapter.executionHistory();
    for (const [index, scenario] of result.scenarios.entries()) {
      const receipts = histories[index] ?? [];
      const gasCostNative18 = receipts.reduce((sum, receipt) => sum + receipt.gasCostNative18, 0n);
      console.log(`evidence ${scenario.scenario}: ${receipts.length} receipts; ${receipts.filter((receipt) => receipt.status === "success").length} successful, ${receipts.filter((receipt) => receipt.status === "reverted").length} reverted; gas ${gasCostNative18} wei-shaped simulation units (not priced USDC)`);
    }
    if (label === "UNSAFE") console.log("Unsafe matrix:", result.scenarios.map((item) => item.passed ? "PASS" : "FAIL").join(", "));
    else console.log("Fixed matrix:", result.scenarios.map((item) => item.passed ? "PASS" : "FAIL").join(", "));
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => { child?.kill("SIGTERM"); });
