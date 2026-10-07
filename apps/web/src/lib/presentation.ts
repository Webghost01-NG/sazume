import type { Fixture, RunEvidence, ScenarioKey } from "./evidenceProvider.js";

export type TraceTone = "neutral" | "success" | "warning" | "danger";
export type TraceKind = "intent" | "transaction" | "fault" | "retry" | "callback" | "fulfillment";

export interface TraceStep {
  key: string;
  kind: TraceKind;
  label: string;
  detail: string;
  tone: TraceTone;
  presentationMs: number;
  tag?: string;
  transaction?: RunEvidence["transactions"][number];
}

export interface RunPresentation {
  fixture: Fixture;
  scenario: ScenarioKey;
  evidence: RunEvidence;
  trace: TraceStep[];
}

const actionDescriptions: Record<string, { label: string; detail: (evidence: RunEvidence, metadata?: Record<string, unknown>) => string; kind: TraceKind; tone: TraceTone }> = {
  timeout: {
    label: "Acknowledgement lost",
    detail: (_evidence, metadata) => metadata?.phase === "before-settlement"
      ? "Request timed out before payment committed."
      : "Payment committed. The application did not receive its acknowledgement.",
    kind: "fault",
    tone: "warning",
  },
  retry: {
    label: "Retry triggered",
    detail: (evidence) => `Same economic intent · ${evidence.intent.intentId}`,
    kind: "retry",
    tone: "warning",
  },
  callback: {
    label: "Application callback received",
    detail: (_evidence, metadata) => metadata?.duplicate
      ? "Duplicate callback delivered to the fulfillment handler."
      : "Callback delivered after settlement.",
    kind: "callback",
    tone: "neutral",
  },
  "fulfillment-attempt": {
    label: "Fulfillment attempt",
    detail: () => "Application attempts to fulfill the paid service.",
    kind: "fulfillment",
    tone: "neutral",
  },
  "fulfillment-observed": {
    label: "Fulfillment recorded",
    detail: () => "Offchain application state records this fulfillment.",
    kind: "fulfillment",
    tone: "success",
  },
};

export function buildRunPresentation(fixture: Fixture, scenario: ScenarioKey, evidence: RunEvidence): RunPresentation {
  const trace: TraceStep[] = [];
  let attemptIndex = 0;

  const append = (step: Omit<TraceStep, "presentationMs">) => {
    trace.push({ ...step, presentationMs: trace.length * 560 });
  };

  append({
    key: "intent-created",
    kind: "intent",
    label: "Economic intent created",
    detail: `${formatUsdc6(evidence.qualificationAmountUsdc6)} USDC · settle no more than once`,
    tone: "neutral",
    tag: "INTENT",
  });

  for (const event of evidence.trace) {
    if (event.type === "settlement-attempt") {
      attemptIndex += 1;
      append({
        key: `attempt-${attemptIndex}`,
        kind: "transaction",
        label: `Settlement attempt ${String(attemptIndex).padStart(2, "0")}`,
        detail: `Intent ${evidence.intent.intentId.slice(0, 12)}… submitted.`,
        tone: "neutral",
        tag: `ATTEMPT ${String(attemptIndex).padStart(2, "0")}`,
      });
      continue;
    }

    if (event.type === "settlement-observed") {
      const transaction = evidence.transactions[attemptIndex - 1];
      if (!transaction) continue;
      const matchingEvent = evidence.matchingEvents.find((item) => item.txHash.toLowerCase() === transaction.hash.toLowerCase());
      const successful = transaction.status === "success";
      append({
        key: `receipt-${attemptIndex}`,
        kind: "transaction",
        label: successful ? "Transaction included" : "Duplicate settlement reverted",
        detail: [
          successful ? "Receipt SUCCESS" : "Receipt REVERTED · no second transfer",
          matchingEvent ? "IntentSettled event matched" : "No matching settlement event",
          `Block ${transaction.blockNumber}`,
        ].join(" · "),
        tone: successful ? "success" : "warning",
        tag: successful ? "SUCCESS" : "REVERTED",
        transaction,
      });
      continue;
    }

    const mapped = actionDescriptions[event.type];
    if (!mapped) continue;
    append({
      key: `${event.type}-${event.sequence}`,
      kind: mapped.kind,
      label: mapped.label,
      detail: mapped.detail(evidence, event.metadata),
      tone: mapped.tone,
      tag: event.type === "timeout" ? "FAULT INJECTED" : event.type === "retry" ? "SAME INTENT" : undefined,
    });
  }

  return { fixture, scenario, evidence, trace };
}

export function formatReplayClock(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000).toString().padStart(2, "0");
  const seconds = Math.floor((milliseconds % 60_000) / 1_000).toString().padStart(2, "0");
  const remainder = (milliseconds % 1_000).toString().padStart(3, "0");
  return `${minutes}:${seconds}.${remainder}`;
}

function formatUsdc6(value: string): string {
  const amount = BigInt(value);
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}
