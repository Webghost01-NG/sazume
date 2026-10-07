import type { EconomicAdapter, EconomicIntent, EconomicOutcome, FulfillmentResult, SettlementResult } from "@sazume/core";

export class UnsafeAdapter implements EconomicAdapter {
  private settlementCount = 0;
  private totalAmount = 0n;
  private fulfillmentCount = 0;
  private completed = false;

  async settle(intent: EconomicIntent): Promise<SettlementResult> {
    this.settlementCount += 1;
    this.totalAmount += intent.payment.amount;
    return { accepted: true, amount: intent.payment.amount };
  }

  async fulfill(_intent: EconomicIntent): Promise<FulfillmentResult> {
    this.fulfillmentCount += 1;
    return { accepted: true };
  }

  async markComplete(_intent: EconomicIntent): Promise<void> { this.completed = true; }

  async observe(intent: EconomicIntent): Promise<EconomicOutcome> {
    return {
      intentId: intent.intentId,
      settlement: { count: this.settlementCount, totalAmount: this.totalAmount },
      fulfillment: { count: this.fulfillmentCount },
      completed: this.completed,
    };
  }

  async reset(): Promise<void> {
    this.settlementCount = 0;
    this.totalAmount = 0n;
    this.fulfillmentCount = 0;
    this.completed = false;
  }
}
