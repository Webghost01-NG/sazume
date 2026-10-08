import { decodeEventLog, parseAbiItem, type Address, type PublicClient } from "viem";
import type { EconomicIntent } from "../../core/src/intent.js";
import type { EconomicOutcome } from "../../core/src/outcome.js";

export interface TransactionObservation {
  hash: `0x${string}`;
  status: "success" | "reverted";
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  gasCostNative18: bigint;
}

export interface SettlementLog {
  intentId: `0x${string}`;
  payer: Address;
  recipient: Address;
  amountUsdc6: bigint;
}

export const intentSettledEvent = parseAbiItem("event IntentSettled(bytes32 indexed intentId, address indexed payer, address indexed recipient, uint256 amount)");

export class ArcObserver {
  constructor(
    private readonly client: PublicClient,
    private readonly contractAddress: Address,
    private readonly fromBlock: bigint,
    private readonly payerFor: (intent: EconomicIntent) => Address,
    private readonly recipientFor: (intent: EconomicIntent) => Address,
  ) {}

  async observe(intent: EconomicIntent, fulfillmentCount: number, completed: boolean, transactions: TransactionObservation[]): Promise<{ outcome: EconomicOutcome; transactions: TransactionObservation[] }> {
    const rawLogs = await this.client.getLogs({ address: this.contractAddress, fromBlock: this.fromBlock, toBlock: "latest" });
    const payer = this.payerFor(intent).toLowerCase();
    const recipient = this.recipientFor(intent).toLowerCase();
    const expectedIntentId = `0x${intent.intentId}`.toLowerCase();
    const decodedEvents = rawLogs.flatMap((log) => {
      try {
        const decoded = decodeEventLog({ abi: [intentSettledEvent], data: log.data, topics: log.topics });
        return decoded.args.intentId.toLowerCase() === expectedIntentId && decoded.args.payer.toLowerCase() === payer && decoded.args.recipient.toLowerCase() === recipient
          ? [{ amountUsdc6: decoded.args.amount, transactionHash: log.transactionHash }]
          : [];
      } catch {
        return [];
      }
    });
    const receiptResults = await Promise.all(decodedEvents.map(async (event) => {
      try { return { event, receipt: await this.client.getTransactionReceipt({ hash: event.transactionHash }) }; }
      catch { return undefined; }
    }));
    const verified = receiptResults.flatMap((item) => item?.receipt.status === "success" ? [item] : []);
    const settlementAmountUsdc6 = verified.reduce((sum, item) => sum + item.event.amountUsdc6, 0n);
    const knownHashes = new Set(transactions.map((transaction) => transaction.hash));
    const eventTransactions: TransactionObservation[] = verified.flatMap(({ event, receipt }) => {
      if (knownHashes.has(event.transactionHash)) return [];
      knownHashes.add(event.transactionHash);
      const gasUsed = receipt.gasUsed;
      if (receipt.effectiveGasPrice === undefined) throw new Error(`OBSERVER INCONSISTENCY: receipt ${event.transactionHash} omitted effectiveGasPrice`);
      const effectiveGasPrice = receipt.effectiveGasPrice;
      return [{ hash: event.transactionHash, status: "success", gasUsed, effectiveGasPrice, gasCostNative18: gasUsed * effectiveGasPrice }];
    });
    return {
      outcome: {
        intentId: intent.intentId,
        settlement: { count: verified.length, totalAmount: settlementAmountUsdc6 },
        fulfillment: { count: fulfillmentCount },
        completed,
      },
      transactions: [...transactions, ...eventTransactions],
    };
  }
}
