import type { EconomicIntent } from "./intent.js";
import type { EconomicOutcome } from "./outcome.js";

export interface InvariantResult {
  name: string;
  passed: boolean;
  expected: string;
  observed: string;
  message?: string;
}

export interface EconomicInvariant {
  name: string;
  evaluate(intent: EconomicIntent, outcome: EconomicOutcome): InvariantResult;
}

function invariant(
  name: string,
  evaluate: (intent: EconomicIntent, outcome: EconomicOutcome) => Omit<InvariantResult, "name">
): EconomicInvariant {
  return { name, evaluate: (intent, outcome) => ({ name, ...evaluate(intent, outcome) }) };
}

export const settlementUniqueness = (): EconomicInvariant => invariant("Settlement uniqueness", (_intent, outcome) => ({
  passed: outcome.settlement.count <= 1,
  expected: "<= 1",
  observed: String(outcome.settlement.count),
  message: outcome.settlement.count > 1 ? "One economic intent produced multiple settlements." : undefined,
}));

export const recipientAmount = (): EconomicInvariant => invariant("Recipient amount", (intent, outcome) => {
  const applicable = outcome.completed;
  const passed = !applicable || outcome.settlement.totalAmount === intent.payment.amount;
  return {
    passed,
    expected: `${(intent.payment.amount / 1_000_000n).toString()}.${(intent.payment.amount % 1_000_000n).toString().padStart(6, "0")} USDC`,
    observed: `${outcome.settlement.totalAmount} base units`,
    message: applicable && !passed ? "Completed intent did not deliver exactly the intended amount." : undefined,
  };
});

export const fulfillmentUniqueness = (): EconomicInvariant => invariant("Fulfillment uniqueness", (_intent, outcome) => ({
  passed: outcome.fulfillment.count <= 1,
  expected: "<= 1",
  observed: String(outcome.fulfillment.count),
  message: outcome.fulfillment.count > 1 ? "One economic intent produced multiple fulfillments." : undefined,
}));

export const completionConsistency = (): EconomicInvariant => invariant("Completion consistency", (_intent, outcome) => {
  const passed = !outcome.completed || (outcome.settlement.count > 0 && outcome.fulfillment.count > 0);
  return {
    passed,
    expected: "completed implies settlement and fulfillment",
    observed: `completed=${outcome.completed}, settlements=${outcome.settlement.count}, fulfillments=${outcome.fulfillment.count}`,
    message: !passed ? "Workflow claimed completion without settlement and fulfillment." : undefined,
  };
});
