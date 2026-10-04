export interface EconomicOutcome {
  intentId: string;
  settlement: { count: number; totalAmount: bigint };
  fulfillment: { count: number };
  completed: boolean;
}

export interface SettlementResult {
  accepted: boolean;
  amount: bigint;
}

export interface FulfillmentResult {
  accepted: boolean;
}
