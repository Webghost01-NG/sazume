/** Replace this in-memory boundary with your application's payment calls. */
export class PaidReportAdapter {
  settlements = new Map();
  fulfillments = new Set();
  completed = new Set();

  async settle(intent) {
    const existing = this.settlements.get(intent.intentId);
    if (existing !== undefined) return { accepted: false, amount: existing };
    this.settlements.set(intent.intentId, intent.payment.amount);
    return { accepted: true, amount: intent.payment.amount };
  }

  async fulfill(intent) {
    if (this.fulfillments.has(intent.intentId)) return { accepted: false };
    this.fulfillments.add(intent.intentId);
    return { accepted: true };
  }

  async markComplete(intent) { this.completed.add(intent.intentId); }

  async observe(intent) {
    const settlementAmount = this.settlements.get(intent.intentId);
    return {
      intentId: intent.intentId,
      settlement: { count: settlementAmount === undefined ? 0 : 1, totalAmount: settlementAmount ?? 0n },
      fulfillment: { count: this.fulfillments.has(intent.intentId) ? 1 : 0 },
      completed: this.completed.has(intent.intentId),
    };
  }

  async reset() {
    this.settlements.clear();
    this.fulfillments.clear();
    this.completed.clear();
  }
}
