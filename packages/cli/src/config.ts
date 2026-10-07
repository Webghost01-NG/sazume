import type { EconomicAdapter } from "../../core/src/adapter.js";
import type { EconomicIntent } from "../../core/src/intent.js";
import type { Scenario } from "../../core/src/scenario.js";

export interface SazumeConfig {
  intent: EconomicIntent;
  adapter: EconomicAdapter;
  scenarios: Scenario[];
}

export function defineConfig(config: SazumeConfig): SazumeConfig {
  return config;
}
