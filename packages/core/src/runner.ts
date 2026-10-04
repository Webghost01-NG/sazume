import type { EconomicAdapter } from "./adapter.js";
import type { EconomicIntent } from "./intent.js";
import type { InvariantResult } from "./invariant.js";
import type { EconomicOutcome } from "./outcome.js";
import type { Scenario } from "./scenario.js";
import { ScenarioTrace, type TraceEntry } from "./trace.js";

export interface ScenarioResult {
  scenario: string;
  outcome: EconomicOutcome;
  invariants: InvariantResult[];
  trace: TraceEntry[];
  passed: boolean;
}

export interface SazumeRunResult {
  intent: EconomicIntent;
  scenarios: ScenarioResult[];
  passed: boolean;
}

export const sazume = {
  async run(input: { intent: EconomicIntent; adapter: EconomicAdapter; scenarios: Scenario[] }): Promise<SazumeRunResult> {
    const scenarios: ScenarioResult[] = [];
    for (const scenario of input.scenarios) {
      await input.adapter.reset();
      const trace = new ScenarioTrace();
      await scenario.run({ intent: input.intent, adapter: input.adapter, trace });
      const outcome = await input.adapter.observe(input.intent);
      const invariants = input.intent.invariants.map((item) => item.evaluate(input.intent, outcome));
      scenarios.push({ scenario: scenario.name, outcome, invariants, trace: trace.entries, passed: invariants.every((item) => item.passed) });
    }
    return { intent: input.intent, scenarios, passed: scenarios.every((scenario) => scenario.passed) };
  },
};
