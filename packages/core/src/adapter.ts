import type { EconomicIntent } from "./intent.js";
import type { EconomicOutcome, FulfillmentResult, SettlementResult } from "./outcome.js";

export interface EconomicAdapter {
  settle(intent: EconomicIntent): Promise<SettlementResult>;
  fulfill(intent: EconomicIntent): Promise<FulfillmentResult>;
  markComplete(intent: EconomicIntent): Promise<void>;
  observe(intent: EconomicIntent): Promise<EconomicOutcome>;
  reset(): Promise<void>;
}
