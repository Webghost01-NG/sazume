import { describe, expect, it } from "vitest";
import { defineIntent, fulfillmentUniqueness, recipientAmount, sazume, settlementUniqueness, completionConsistency } from "../packages/core/src/index.js";
import type { EconomicOutcome } from "../packages/core/src/outcome.js";
import { duplicateCallback } from "../scenarios/duplicate-callback.js";
import { normal } from "../scenarios/normal.js";
import { timeoutAfterSettlement } from "../scenarios/timeout-after-settlement.js";
import { timeoutBeforeSettlement } from "../scenarios/timeout-before-settlement.js";
import { FixedAdapter } from "../demo/fixed-adapter.js";
import { UnsafeAdapter } from "../demo/unsafe-adapter.js";

const invariants = [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()];
function makeIntent(id = "ORDER-7F21") {
  return defineIntent({
    id,
    payment: { payer: "customer", recipient: "merchant", asset: { symbol: "USDC", decimals: 6 }, amount: 1_000_000n },
    invariants,
  });
}
function outcome(overrides: Partial<EconomicOutcome> = {}): EconomicOutcome {
  return {
    intentId: makeIntent().intentId,
    settlement: { count: 1, totalAmount: 1_000_000n },
    fulfillment: { count: 1 },
    completed: true,
    ...overrides,
  };
}
const scenarios = [normal(), timeoutBeforeSettlement(), timeoutAfterSettlement(), duplicateCallback()];

describe("EconomicIntent", () => {
  it("creates deterministic machine identity for the same human ID", () => {
    expect(makeIntent().intentId).toBe(makeIntent().intentId);
  });
  it("distinguishes different human IDs", () => {
    expect(makeIntent("ORDER-A").intentId).not.toBe(makeIntent("ORDER-B").intentId);
  });
  it("keeps monetary amount as bigint and retries retain intent identity", async () => {
    const intent = makeIntent();
    expect(typeof intent.payment.amount).toBe("bigint");
    const adapter = new FixedAdapter();
    await adapter.settle(intent);
    await adapter.settle(intent);
    expect((await adapter.observe(intent)).intentId).toBe(intent.intentId);
  });
});

describe("built-in invariants", () => {
  it("checks settlement uniqueness", () => {
    expect(settlementUniqueness().evaluate(makeIntent(), outcome()).passed).toBe(true);
    expect(settlementUniqueness().evaluate(makeIntent(), outcome({ settlement: { count: 2, totalAmount: 2_000_000n } })).passed).toBe(false);
  });
  it("checks exact completed recipient amount", () => {
    expect(recipientAmount().evaluate(makeIntent(), outcome()).passed).toBe(true);
    expect(recipientAmount().evaluate(makeIntent(), outcome({ settlement: { count: 2, totalAmount: 2_000_000n } })).passed).toBe(false);
    expect(recipientAmount().evaluate(makeIntent(), outcome({ settlement: { count: 1, totalAmount: 999_999n } })).passed).toBe(false);
  });
  it("checks fulfillment uniqueness", () => {
    expect(fulfillmentUniqueness().evaluate(makeIntent(), outcome()).passed).toBe(true);
    expect(fulfillmentUniqueness().evaluate(makeIntent(), outcome({ fulfillment: { count: 2 } })).passed).toBe(false);
  });
  it("checks completion consistency", () => {
    expect(completionConsistency().evaluate(makeIntent(), outcome()).passed).toBe(true);
    expect(completionConsistency().evaluate(makeIntent(), outcome({ fulfillment: { count: 0 } })).passed).toBe(false);
    expect(completionConsistency().evaluate(makeIntent(), outcome({ settlement: { count: 0, totalAmount: 0n } })).passed).toBe(false);
  });
});

describe("adapters", () => {
  it("allows duplicate economic changes in UnsafeAdapter", async () => {
    const adapter = new UnsafeAdapter();
    const intent = makeIntent();
    await adapter.settle(intent);
    await adapter.settle(intent);
    await adapter.fulfill(intent);
    await adapter.fulfill(intent);
    const observed = await adapter.observe(intent);
    expect(observed.settlement).toEqual({ count: 2, totalAmount: 2_000_000n });
    expect(observed.fulfillment.count).toBe(2);
  });
  it("makes duplicate calls idempotent in FixedAdapter", async () => {
    const adapter = new FixedAdapter();
    const intent = makeIntent();
    await adapter.settle(intent);
    await adapter.settle(intent);
    await adapter.fulfill(intent);
    await adapter.fulfill(intent);
    const observed = await adapter.observe(intent);
    expect(observed.settlement).toEqual({ count: 1, totalAmount: 1_000_000n });
    expect(observed.fulfillment.count).toBe(1);
  });
});

describe("shared scenarios and runner", () => {
  it("produces the required pass/fail matrix for the same scenarios", async () => {
    const intent = makeIntent();
    const unsafe = await sazume.run({ intent, adapter: new UnsafeAdapter(), scenarios });
    const fixed = await sazume.run({ intent, adapter: new FixedAdapter(), scenarios });
    expect(unsafe.scenarios.map((result) => result.passed)).toEqual([true, true, false, false]);
    expect(fixed.scenarios.map((result) => result.passed)).toEqual([true, true, true, true]);
    expect(unsafe.scenarios[0]?.outcome.settlement.count).toBe(1);
    expect(unsafe.scenarios[1]?.outcome.settlement.count).toBe(1);
    expect(unsafe.scenarios[2]?.outcome.settlement).toEqual({ count: 2, totalAmount: 2_000_000n });
    expect(unsafe.scenarios[3]?.outcome.fulfillment.count).toBe(2);
  });
  it("isolates every scenario and preserves deterministic hero trace ordering", async () => {
    const result = await sazume.run({ intent: makeIntent(), adapter: new UnsafeAdapter(), scenarios: [timeoutAfterSettlement()] });
    expect(result.scenarios[0]?.trace.map((entry) => [entry.sequence, entry.type])).toEqual([
      [1, "settlement-attempt"],
      [2, "settlement-observed"],
      [3, "timeout"],
      [4, "retry"],
      [5, "settlement-attempt"],
      [6, "settlement-observed"],
      [7, "fulfillment-attempt"],
      [8, "fulfillment-observed"],
    ]);
    expect(result.scenarios[0]?.trace.every((entry) => entry.intentId === makeIntent().intentId)).toBe(true);
  });
});
