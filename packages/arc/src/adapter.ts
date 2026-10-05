import { decodeEventLog, encodeFunctionData, type Address, type PublicClient, type WalletClient } from "viem";
import type { EconomicAdapter } from "../../core/src/adapter.js";
import type { EconomicIntent } from "../../core/src/intent.js";
import type { EconomicOutcome, FulfillmentResult, SettlementResult } from "../../core/src/outcome.js";
import { ArcObserver, intentSettledEvent, type TransactionObservation } from "./observer.js";

const settleAbi = [{ type: "function", name: "settle", stateMutability: "nonpayable", inputs: [{ name: "intentId", type: "bytes32" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }] as const;

export class ArcEconomicAdapter implements EconomicAdapter {
  private readonly fulfillmentCounts = new Map<string, number>();
  private readonly completions = new Set<string>();
  private readonly txObservations: TransactionObservation[] = [];
  private readonly priorScenarioTransactions: TransactionObservation[][] = [];
  private observer: ArcObserver;
  private activeContractAddress: Address;

  constructor(private readonly options: {
    publicClient: PublicClient;
    walletClient: WalletClient;
    contractAddress: Address;
    payerFor: (intent: EconomicIntent) => Address;
    recipientFor: (intent: EconomicIntent) => Address;
    idempotentFulfillment: boolean;
    fromBlock: bigint;
    resetForScenario: () => Promise<{ contractAddress: Address; fromBlock: bigint }>;
  }) {
    this.activeContractAddress = options.contractAddress;
    this.observer = new ArcObserver(options.publicClient, options.contractAddress, options.fromBlock, options.payerFor, options.recipientFor);
  }

  async settle(intent: EconomicIntent): Promise<SettlementResult> {
    await this.assertArcExecutionChain();
    const payer = this.options.payerFor(intent);
    const recipient = this.options.recipientFor(intent);
    const data = encodeFunctionData({ abi: settleAbi, functionName: "settle", args: [`0x${intent.intentId}`, recipient, intent.payment.amount] });
    const fees = await this.options.publicClient.estimateFeesPerGas();
    const arcTestnetFloor = this.options.publicClient.chain?.id === 5_042_002 ? 20_000_000_000n : 0n;
    const maxFeePerGas = fees.maxFeePerGas > arcTestnetFloor ? fees.maxFeePerGas : arcTestnetFloor;
    const hash = await this.options.walletClient.sendTransaction({
      account: this.options.walletClient.account!, chain: this.options.walletClient.chain,
      to: this.activeContractAddress, data, gas: 300_000n, maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0n,
    });
    const receipt = await this.options.publicClient.waitForTransactionReceipt({ hash });
    const gasUsed = receipt.gasUsed;
    if (receipt.effectiveGasPrice === undefined) throw new Error(`OBSERVER INCONSISTENCY: receipt ${hash} omitted effectiveGasPrice`);
    const effectiveGasPrice = receipt.effectiveGasPrice;
    this.txObservations.push({ hash, status: receipt.status === "success" ? "success" : "reverted", gasUsed, effectiveGasPrice, gasCostNative18: gasUsed * effectiveGasPrice });
    const logs = await this.options.publicClient.getLogs({ address: this.activeContractAddress, fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber });
    const accepted = receipt.status === "success" && logs.some((log) => {
      if (log.transactionHash !== hash) return false;
      try {
        const event = decodeEventLog({ abi: [intentSettledEvent], data: log.data, topics: log.topics });
        return event.args.intentId.toLowerCase() === `0x${intent.intentId}`.toLowerCase() && event.args.payer.toLowerCase() === payer.toLowerCase();
      } catch { return false; }
    });
    return { accepted, amount: accepted ? intent.payment.amount : 0n };
  }

  private async assertArcExecutionChain(): Promise<void> {
    const configuredPublicId = this.options.publicClient.chain?.id;
    const configuredWalletId = this.options.walletClient.chain?.id;
    if (configuredPublicId === 5_042 || configuredWalletId === 5_042) {
      throw new Error("MAINNET EXECUTION DISABLED DURING PHASE 6.5");
    }
    if (configuredPublicId === 5_042_002 || configuredWalletId === 5_042_002) {
      if (configuredPublicId !== 5_042_002 || configuredWalletId !== 5_042_002) {
        throw new Error("Arc Testnet public and wallet clients must both use chain ID 5042002");
      }
      if (typeof this.options.publicClient.getChainId !== "function") {
        throw new Error("Cannot verify the Arc Testnet RPC chain ID before transaction submission");
      }
      const actualChainId = await this.options.publicClient.getChainId();
      if (actualChainId !== 5_042_002) {
        throw new Error(`Arc Testnet chain guard rejected RPC chain ID ${actualChainId}; expected 5042002`);
      }
      return;
    }
    if (configuredPublicId !== undefined && configuredWalletId !== undefined && configuredPublicId !== configuredWalletId) {
      throw new Error(`Public and wallet client chain IDs differ: ${configuredPublicId} vs ${configuredWalletId}`);
    }
  }

  async fulfill(intent: EconomicIntent): Promise<FulfillmentResult> {
    const existing = this.fulfillmentCounts.get(intent.intentId) ?? 0;
    if (this.options.idempotentFulfillment && existing > 0) return { accepted: false };
    this.fulfillmentCounts.set(intent.intentId, existing + 1);
    return { accepted: true };
  }

  async markComplete(intent: EconomicIntent): Promise<void> { this.completions.add(intent.intentId); }

  async observe(intent: EconomicIntent): Promise<EconomicOutcome> {
    return (await this.observer.observe(intent, this.fulfillmentCounts.get(intent.intentId) ?? 0, this.completions.has(intent.intentId), this.txObservations)).outcome;
  }

  async observeWithExecution(intent: EconomicIntent) {
    return this.observer.observe(intent, this.fulfillmentCounts.get(intent.intentId) ?? 0, this.completions.has(intent.intentId), this.txObservations);
  }

  executionHistory(): TransactionObservation[][] {
    return [...this.priorScenarioTransactions.map((items) => [...items]), [...this.txObservations]];
  }

  async reset(): Promise<void> {
    if (this.txObservations.length > 0) this.priorScenarioTransactions.push([...this.txObservations]);
    this.fulfillmentCounts.clear();
    this.completions.clear();
    this.txObservations.length = 0;
    const fixture = await this.options.resetForScenario();
    this.activeContractAddress = fixture.contractAddress;
    this.observer = new ArcObserver(this.options.publicClient, fixture.contractAddress, fixture.fromBlock, this.options.payerFor, this.options.recipientFor);
  }
}
