import matrixRecord from "../../../../evidence/testnet/full-matrix.json";

export interface RunEvidence {
  network: string;
  chainId: number;
  rpcUrl: string;
  scenario: string;
  intent: {
    humanId: string;
    intentId: string;
    retryIdentityPreserved: boolean;
  };
  contract: string;
  payerAddress: string;
  recipientAddress: string;
  usdcAddress: string;
  qualificationAmountUsdc6: string;
  demoNarrativeAmountUsdc6: string;
  recipientBalanceBeforeUsdc6: string;
  recipientBalanceAfterUsdc6: string;
  recipientDeltaUsdc6: string;
  settlementAttempts: number;
  successfulReceipts: number;
  revertedReceipts: number;
  matchingEvents: Array<{
    txHash: string;
    amountUsdc6: string;
    receiptStatus: string;
  }>;
  observedSettlementCount: number;
  observedSettlementAmountUsdc6: string;
  fulfillmentCount: number;
  invariantResults: Array<{
    name: string;
    passed: boolean;
    expected: string;
    observed: string;
    message?: string;
  }>;
  passed: boolean;
  receiptEventBalanceAgreement: boolean;
  inconsistency: string[];
  verdict: "PASS" | "FAIL";
  transactions: Array<{
    hash: string;
    status: "success" | "reverted";
    blockNumber: string;
    gasUsed: string;
    effectiveGasPrice: string;
    gasCostNative18: string;
    gasCostUsdc6: string;
  }>;
  trace: Array<{
    sequence: number;
    type: string;
    intentId: string;
    metadata?: Record<string, unknown>;
  }>;
  finality: string;
}

export type Fixture = "unsafe" | "fixed";
export type ScenarioKey = "normal" | "timeout-before-settlement" | "timeout-after-settlement" | "duplicate-callback";
export interface QualificationOutcome { fixture: Fixture; scenario: ScenarioKey; result: "PASS" | "FAIL" }
export interface QualificationMatrix { network: string; chainId: number; outcomes: QualificationOutcome[] }

export interface EvidenceProvider {
  readonly networkLabel: string;
  loadRun(fixture: Fixture, scenario: ScenarioKey): RunEvidence;
  loadMatrix(): QualificationMatrix;
}

const matrixRecordTyped = matrixRecord as QualificationMatrix;
const evidenceFiles = import.meta.glob<RunEvidence>("../../../../evidence/testnet/*/run.json", {
  eager: true,
  import: "default",
});

const scenarioDirectories: Record<ScenarioKey, (fixture: Fixture) => string> = {
  normal: (fixture) => `normal-${fixture}`,
  "timeout-before-settlement": (fixture) => `timeout-before-${fixture}`,
  "timeout-after-settlement": (fixture) => `hero-${fixture}`,
  "duplicate-callback": (fixture) => `duplicate-callback-${fixture}`,
};

export function createVerifiedReplayProvider(
  runs: Record<string, RunEvidence>,
  matrix: QualificationMatrix,
): EvidenceProvider {
  return {
    networkLabel: "ARC TESTNET",
    loadMatrix() {
      if (matrix.network !== "arc-testnet" || matrix.chainId !== 5_042_002 || matrix.outcomes.length !== 8) {
        throw new Error("Arc Testnet qualification matrix failed its network or completeness check.");
      }
      return matrix;
    },
    loadRun(fixture, scenario) {
      const directory = scenarioDirectories[scenario](fixture);
      const evidence = runs[directory];
      if (!evidence) throw new Error(`Verified Testnet evidence is missing: ${directory}/run.json`);
      if (evidence.network !== "arc-testnet" || evidence.chainId !== 5_042_002) {
        throw new Error(`Evidence network mismatch in ${directory}/run.json`);
      }
      if (!evidence.receiptEventBalanceAgreement || evidence.inconsistency.length > 0) {
        throw new Error(`Economic evidence is not corroborated in ${directory}/run.json`);
      }
      return evidence;
    },
  };
}

const runsByDirectory = Object.fromEntries(
  Object.entries(evidenceFiles).map(([path, evidence]) => [path.split("/").at(-2) ?? "", evidence]),
);

export const testnetEvidenceProvider = createVerifiedReplayProvider(runsByDirectory, matrixRecordTyped);

export function formatUsdc6(value: string | bigint): string {
  const amount = typeof value === "bigint" ? value : BigInt(value);
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

export function abbreviate(value: string, head = 8, tail = 6): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}
