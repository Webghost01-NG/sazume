import type { EconomicAdapter } from "./adapter.js";
import type { EconomicIntent } from "./intent.js";
import { ScenarioTrace } from "./trace.js";

export interface ScenarioContext {
  intent: EconomicIntent;
  adapter: EconomicAdapter;
  trace: ScenarioTrace;
}

export interface Scenario {
  name: string;
  run(context: ScenarioContext): Promise<void>;
}
