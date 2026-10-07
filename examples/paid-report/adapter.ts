import type { EconomicAdapter } from "../../packages/core/src/adapter.js";
import type { EconomicIntent } from "../../packages/core/src/intent.js";
import type { EconomicOutcome, FulfillmentResult, SettlementResult } from "../../packages/core/src/outcome.js";

/** Replace this in-memory boundary with your own payment and fulfillment calls. */
export class PaidReportAdapter implements EconomicAdapter {
  private settlements = new Map<string, bigint>();
  private fulfillments = new Set<string>();
  private completed = new Set<string>();

  async settle(intent: EconomicIntent): Promise<SettlementResult> {
    if (this.settlements.has(intent.intentId)) return { accepted: false, amount: this.settlements.get(intent.intentId)! };
    this.settlements.set(intent.intentId, intent.payment.amount);
    return { accepted: true, amount: intent.payment.amount };
  }

  async fulfill(intent: EconomicIntent): Promise<FulfillmentResult> {
    if (this.fulfillments.has(intent.intentId)) return { accepted: false };
    this.fulfillments.add(intent.intentId);
    return { accepted: true };
  }

  async markComplete(intent: EconomicIntent): Promise<void> { this.completed.add(intent.intentId); }

  async observe(intent: EconomicIntent): Promise<EconomicOutcome> {
    const settlement = this.settlements.get(intent.intentId);
    return {
      intentId: intent.intentId,
      settlement: { count: settlement === undefined ? 0 : 1, totalAmount: settlement ?? 0n },
      fulfillment: { count: this.fulfillments.has(intent.intentId) ? 1 : 0 },
      completed: this.completed.has(intent.intentId),
    };
  }

  async reset(): Promise<void> {
    this.settlements.clear();
    this.fulfillments.clear();
    this.completed.clear();
  }
}
