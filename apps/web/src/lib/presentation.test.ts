import { describe, expect, it } from "vitest";
import { testnetEvidenceProvider } from "./evidenceProvider.js";
import { buildRunPresentation } from "./presentation.js";

describe("verified Arc Testnet replay data", () => {
  it("loads the accepted unsafe hero as a failed economic outcome with successful receipts", () => {
    const evidence = testnetEvidenceProvider.loadRun("unsafe", "timeout-after-settlement");

    expect(evidence.network).toBe("arc-testnet");
    expect(evidence.chainId).toBe(5_042_002);
    expect(evidence.verdict).toBe("FAIL");
    expect(evidence.transactions.map((transaction) => transaction.status)).toEqual(["success", "success"]);
    expect(evidence.receiptEventBalanceAgreement).toBe(true);
    expect(evidence.qualificationAmountUsdc6).toBe("10000");
    expect(evidence.recipientDeltaUsdc6).toBe("20000");
  });

  it("loads the accepted fixed hero as a pass with a reverted duplicate attempt", () => {
    const evidence = testnetEvidenceProvider.loadRun("fixed", "timeout-after-settlement");

    expect(evidence.verdict).toBe("PASS");
    expect(evidence.transactions.map((transaction) => transaction.status)).toEqual(["success", "reverted"]);
    expect(evidence.matchingEvents).toHaveLength(1);
    expect(evidence.recipientDeltaUsdc6).toBe("10000");
  });

  it("shows that the retry preserves the exact machine intent ID", () => {
    const presentation = buildRunPresentation(
      "unsafe",
      "timeout-after-settlement",
      testnetEvidenceProvider.loadRun("unsafe", "timeout-after-settlement"),
    );
    const retry = presentation.trace.find((step) => step.tag === "SAME INTENT");

    expect(retry?.detail).toContain(presentation.evidence.intent.intentId);
  });
});
