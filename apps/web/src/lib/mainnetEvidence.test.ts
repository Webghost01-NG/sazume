import { describe, expect, it } from "vitest";
import { mainnetQualification } from "./mainnetEvidence.js";

describe("independently corroborated Mainnet hero record", () => {
  it("keeps both retries on their original economic intent", () => {
    for (const run of [mainnetQualification.unsafe, mainnetQualification.fixed]) {
      expect(new Set(run.trace.map((entry) => entry.intentId))).toEqual(new Set([run.intentId]));
      expect(run.transactions).toHaveLength(2);
    }
  });

  it("derives unsafe failure and idempotent preservation from recorded economics", () => {
    const { unsafe, fixed, verification } = mainnetQualification;
    expect(unsafe.settlement.count).toBe(2);
    expect(unsafe.recipientDeltaUsdc6).toBe("20000");
    expect(unsafe.invariants.some((item) => !item.passed)).toBe(true);
    expect(fixed.settlement.count).toBe(1);
    expect(fixed.recipientDeltaUsdc6).toBe("10000");
    expect(fixed.transactions[1]?.status).toBe("reverted");
    expect(fixed.invariants.every((item) => item.passed)).toBe(true);
    expect(verification.settlementCount).toBe(3);
  });
});
