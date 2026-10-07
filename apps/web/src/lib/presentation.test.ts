import { describe, expect, it } from "vitest";
import { testnetEvidenceProvider } from "./evidenceProvider.js";
import { buildRunPresentation, formatReplayClock } from "./presentation.js";

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

  it("keeps both unsafe chain receipts successful before economic analysis", () => {
    const presentation = buildRunPresentation(
      "unsafe",
      "timeout-after-settlement",
      testnetEvidenceProvider.loadRun("unsafe", "timeout-after-settlement"),
    );
    const receiptSteps = presentation.trace.filter((step) => step.transaction);

    expect(receiptSteps.map((step) => step.tag)).toEqual(["SUCCESS", "SUCCESS"]);
    expect(receiptSteps.map((step) => step.transaction?.hash)).toEqual(
      presentation.evidence.transactions.map((transaction) => transaction.hash),
    );
    expect(presentation.trace.findIndex((step) => step.kind === "fault"))
      .toBeLessThan(presentation.trace.findIndex((step) => step.kind === "retry"));
    expect(presentation.trace.at(-1)?.kind).toBe("fulfillment");
  });

  it("formats presentation time without claiming historical chain latency", () => {
    expect(formatReplayClock(1_416)).toBe("00:01.416");
  });
});
