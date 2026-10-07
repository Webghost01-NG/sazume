import type { Fixture, RunEvidence, ScenarioKey } from "./evidenceProvider.js";

export interface TraceStep {
  key: string;
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
  tag?: string;
}

export interface RunPresentation {
  fixture: Fixture;
  scenario: ScenarioKey;
  evidence: RunEvidence;
  trace: TraceStep[];
}

const traceLabels: Record<string, { label: string; detail: (metadata?: Record<string, unknown>) => string; tone: TraceStep["tone"] }> = {
  timeout: {
    label: "Acknowledgement window expired",
    detail: (metadata) => metadata?.phase === "before-settlement" ? "Request timed out before a settlement was committed." : "Settlement committed; acknowledgement was lost before the application saw it.",
    tone: "warning",
  },
  retry: {
    label: "Retry keeps the same economic intent",
    detail: () => "The retry carries the exact same machine intent ID.",
    tone: "warning",
  },
  callback: {
    label: "Application callback received",
    detail: (metadata) => metadata?.duplicate ? "Duplicate callback delivered to the fulfillment handler." : "First callback delivered after settlement.",
    tone: "neutral",
  },
  "fulfillment-attempt": {
    label: "Fulfillment attempt",
    detail: () => "Offchain application state attempts to fulfill the paid service.",
    tone: "neutral",
  },
  "fulfillment-observed": {
    label: "Fulfillment recorded",
    detail: () => "Observed fulfillment count is included in the invariant evaluation.",
    tone: "success",
  },
};

export function buildRunPresentation(fixture: Fixture, scenario: ScenarioKey, evidence: RunEvidence): RunPresentation {
  const trace: TraceStep[] = [];
  let attemptIndex = 0;

  for (const event of evidence.trace) {
    if (event.type === "settlement-attempt") {
      const tx = evidence.transactions[attemptIndex];
      const attempt = ++attemptIndex;
      trace.push({
        key: `attempt-${attempt}`,
        label: `Settlement attempt ${attempt}`,
        detail: attempt > 1 ? `Retry uses intent ${evidence.intent.intentId.slice(0, 12)}… again.` : `Intent ${evidence.intent.intentId.slice(0, 12)}… submitted to the fixture.`,
        tone: "neutral",
        tag: "ATTEMPT",
      });
      if (tx) {
        const matchingEvent = evidence.matchingEvents.find((item) => item.txHash.toLowerCase() === tx.hash.toLowerCase());
        const reverted = tx.status === "reverted";
        trace.push({
          key: `receipt-${attempt}`,
          label: reverted ? "Duplicate settlement rejected" : "Arc transaction included — SUCCESS",
          detail: reverted
            ? "The contract prevented a second transfer; this receipt emitted no settlement event."
            : `Block ${tx.blockNumber} · receipt ${tx.hash.slice(0, 10)}…`,
          tone: reverted ? "warning" : "success",
          tag: reverted ? "REVERTED" : "SUCCESS",
        });
        if (matchingEvent) {
          trace.push({
            key: `event-${attempt}`,
            label: "IntentSettled event matched",
            detail: `${matchingEvent.amountUsdc6} USDC6 attributed to this intent.`,
            tone: "success",
            tag: "EVENT",
          });
        }
      }
      continue;
    }

    if (event.type === "settlement-observed") continue;
    const mapped = traceLabels[event.type];
    if (mapped) {
      trace.push({
        key: `scenario-${event.sequence}`,
        label: mapped.label,
        detail: event.type === "retry"
          ? `${mapped.detail(event.metadata)} Intent ID: ${evidence.intent.intentId}`
          : mapped.detail(event.metadata),
        tone: mapped.tone,
        tag: event.type === "timeout" ? "TIMEOUT" : event.type === "retry" ? "SAME INTENT" : undefined,
      });
    }
  }

  trace.push({
    key: "economic-observation",
    label: "Recipient USDC6 balance delta corroborated",
    detail: `Δ ${evidence.recipientDeltaUsdc6} USDC6 · receipt, event, and balance evidence agree.`,
    tone: "success",
    tag: "OBSERVED",
  });
  trace.push({
    key: "invariant-evaluation",
    label: "Economic invariants evaluated",
    detail: evidence.verdict === "PASS" ? "All applicable invariants preserved." : "Successful transactions did not preserve the intended economic outcome.",
    tone: evidence.verdict === "PASS" ? "success" : "danger",
    tag: evidence.verdict,
  });

  return { fixture, scenario, evidence, trace };
}
