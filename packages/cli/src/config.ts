import type { EconomicAdapter, EconomicIntent, Scenario } from "@sazume/core";

export interface SazumeConfig {
  intent: EconomicIntent;
  adapter: EconomicAdapter;
  scenarios: Scenario[];
}

export function defineConfig(config: SazumeConfig): SazumeConfig {
  return config;
}
