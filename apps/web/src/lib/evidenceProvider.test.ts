import { describe, expect, it } from "vitest";
import { createVerifiedReplayProvider, testnetEvidenceProvider } from "./evidenceProvider.js";

describe("verified evidence provider boundary", () => {
  it("supplies each run and the qualification matrix from verified records", () => {
    const matrix = testnetEvidenceProvider.loadMatrix();
    expect(matrix.outcomes).toHaveLength(8);
    expect(matrix.outcomes.find((entry) => entry.fixture === "unsafe" && entry.scenario === "timeout-after-settlement")?.result).toBe("FAIL");
    expect(testnetEvidenceProvider.loadRun("unsafe", "timeout-after-settlement").transactions[0].hash).toMatch(/^0x/);
  });

  it("rejects incomplete or non-testnet records instead of manufacturing presentation data", () => {
    const run = testnetEvidenceProvider.loadRun("unsafe", "timeout-after-settlement");
    const goodMatrix = testnetEvidenceProvider.loadMatrix();
    expect(() => createVerifiedReplayProvider({ "hero-unsafe": { ...run, chainId: 5042 } }, goodMatrix)
      .loadRun("unsafe", "timeout-after-settlement")).toThrow(/network mismatch/);
    expect(() => createVerifiedReplayProvider({ "hero-unsafe": run }, { ...goodMatrix, outcomes: [] }).loadMatrix())
      .toThrow(/completeness/);
  });
});
