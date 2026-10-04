import type { ScenarioContext } from "../packages/core/src/scenario.js";

export async function settle(context: ScenarioContext): Promise<void> {
  context.trace.add("settlement-attempt", context.intent.intentId);
  await context.adapter.settle(context.intent);
  context.trace.add("settlement-observed", context.intent.intentId);
}

export async function fulfill(context: ScenarioContext): Promise<void> {
  context.trace.add("fulfillment-attempt", context.intent.intentId);
  await context.adapter.fulfill(context.intent);
  context.trace.add("fulfillment-observed", context.intent.intentId);
}

export async function complete(context: ScenarioContext): Promise<void> {
  await context.adapter.markComplete(context.intent);
}
