import { useEffect, useMemo, useReducer, useState } from "react";
import {
  abbreviate,
  formatUsdc6,
  testnetEvidenceProvider,
  type Fixture,
  type ScenarioKey,
} from "./lib/evidenceProvider.js";
import { buildRunPresentation, formatReplayClock, type TraceStep } from "./lib/presentation.js";
import { initialRunState, runMachineReducer } from "./lib/runMachine.js";
import { EconomicVerdict } from "./components/EconomicVerdict.js";
import { ProofInspector } from "./components/ProofInspector.js";

const scenarios: Array<{ id: ScenarioKey; title: string; description: string }> = [
  { id: "normal", title: "NORMAL", description: "Settle once, then fulfill." },
  { id: "timeout-before-settlement", title: "TIMEOUT BEFORE", description: "The request expires before settlement." },
  { id: "timeout-after-settlement", title: "TIMEOUT AFTER", description: "Payment commits; acknowledgement is lost." },
  { id: "duplicate-callback", title: "DUPLICATE CALLBACK", description: "The fulfillment callback arrives twice." },
];

const scenarioLabels: Record<ScenarioKey, string> = {
  normal: "NORMAL",
  "timeout-before-settlement": "TIMEOUT BEFORE SETTLEMENT",
  "timeout-after-settlement": "TIMEOUT AFTER SETTLEMENT",
  "duplicate-callback": "DUPLICATE CALLBACK",
};

const qualificationMatrix = testnetEvidenceProvider.loadMatrix();

function CopyValue({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={`copy-value ${className}`} type="button" onClick={copy} title={`Copy ${label}`} aria-label={`Copy ${label}`}>
      <span>{copied ? "COPIED" : abbreviate(value, 12, 8)}</span><span aria-hidden="true">{copied ? "✓" : "↗"}</span>
    </button>
  );
}

function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 25 12 7h5L9 25H4Zm10 0 8-18h5l-8 18h-5Z" /><path d="M9 16h14" /></svg>;
}

function IntentBranches({ intentId, humanId, amountUsdc6, receipts, evidence, complete }: {
  intentId: string;
  humanId: string;
  amountUsdc6: string;
  receipts: TraceStep[];
  evidence: ReturnType<typeof testnetEvidenceProvider.loadRun>;
  complete: boolean;
}) {
  if (receipts.length === 0) return null;

  const observedDelta = formatUsdc6(evidence.recipientDeltaUsdc6);
  const intentAmount = formatUsdc6(amountUsdc6);
  const failed = evidence.verdict === "FAIL";

  return (
    <section className="intent-branches" aria-label="Transactions and economic outcome for one intent">
      <div className="branch-root">
        <span className="branch-root-mark" aria-hidden="true">○</span>
        <div><small>ONE ECONOMIC INTENT</small><strong>{humanId}</strong></div>
        <CopyValue value={intentId} label="economic intent ID" />
      </div>
      <div className="branch-receipts">
        {receipts.map((step, index) => {
          const transaction = step.transaction;
          if (!transaction) return null;
          const succeeded = transaction.status === "success";
          return (
            <article className={`branch-receipt ${succeeded ? "receipt-success" : "receipt-reverted"}`} key={transaction.hash}>
              <span className="branch-symbol" aria-hidden="true">{succeeded ? "✓" : "↩"}</span>
              <div><small>TX {String(index + 1).padStart(2, "0")}</small><strong>{succeeded ? "SUCCESS" : "DUPLICATE PREVENTED"}</strong></div>
              <code>{abbreviate(transaction.hash, 10, 8)}</code>
            </article>
          );
        })}
      </div>
      {complete ? (
        <div className={`branch-outcome ${failed ? "outcome-failed" : "outcome-preserved"}`}>
          <div><small>RECIPIENT BALANCE DELTA</small><strong>+{observedDelta} <span>USDC</span></strong></div>
          <div className="branch-comparison"><small>INTENDED</small><strong>{intentAmount} USDC</strong><span aria-hidden="true">→</span><small>OBSERVED</small><strong>{observedDelta} USDC</strong></div>
          <b>{failed ? "× VIOLATED" : "✓ PRESERVED"}</b>
        </div>
      ) : <p className="branch-pending">Same intent on every attempt. Economic result awaits reconciliation.</p>}
    </section>
  );
}

function ExecutionTimeline({ steps, stage }: { steps: TraceStep[]; stage: "running" | "analyzing" | "complete" }) {
  return (
    <ol className="execution-timeline" aria-label="Verified execution timeline" aria-live="polite">
      {steps.map((step, index) => (
        <li className={`timeline-row tone-${step.tone}`} key={step.key}>
          <span className="timeline-number">{String(index + 1).padStart(2, "0")}</span>
          <time className="timeline-time">{formatReplayClock(step.presentationMs)}</time>
          <span className="timeline-symbol" aria-hidden="true">{step.tone === "success" ? "✓" : step.tone === "danger" ? "×" : step.tone === "warning" ? "!" : "—"}</span>
          <div className="timeline-copy"><strong>{step.label}</strong><small>{step.detail}</small></div>
          {step.tag && <span className="timeline-status">{step.tag}</span>}
        </li>
      ))}
      {stage === "running" && <li className="timeline-progress" aria-label="Replaying recorded evidence"><span /> REPLAYING RECORDED EVIDENCE</li>}
    </ol>
  );
}

function QualificationSection({ scenario }: { scenario: ScenarioKey }) {
  return (
    <details className="qualification-section">
      <summary>OPEN VALIDATION RECORD <span>ARC TESTNET · FOUR SCENARIOS · TWO IMPLEMENTATIONS</span></summary>
      <div className="qualification-content">
        <h2>QUALIFIED ACROSS<br />FOUR EXECUTION ENVIRONMENTS.</h2>
        <p className="qualification-environments">OFFCHAIN <span>→</span> ORDINARY ANVIL <span>→</span> ARC FOUNDRY <span>→</span> ARC TESTNET</p>
        <div className="qualification-table" role="table" aria-label="Arc Testnet qualification matrix">
          <div className="qualification-row qualification-head" role="row"><span>SCENARIO</span><span>UNSAFE</span><span>IDEMPOTENT</span></div>
          {scenarios.map((item) => {
            const unsafe = qualificationMatrix.outcomes.find((row) => row.fixture === "unsafe" && row.scenario === item.id)?.result;
            const fixed = qualificationMatrix.outcomes.find((row) => row.fixture === "fixed" && row.scenario === item.id)?.result;
            return <div className={`qualification-row ${scenario === item.id ? "selected-qualification" : ""}`} role="row" key={item.id}><span>{item.title}</span><span>{unsafe === "PASS" ? "✓" : "×"} {unsafe}</span><span>{fixed === "PASS" ? "✓" : "×"} {fixed}</span></div>;
          })}
        </div>
      </div>
    </details>
  );
}

export default function App() {
  const [fixture, setFixture] = useState<Fixture>("unsafe");
  const [scenario, setScenario] = useState<ScenarioKey>("timeout-after-settlement");
  const [runState, dispatch] = useReducer(runMachineReducer, initialRunState);
  const evidence = useMemo(() => testnetEvidenceProvider.loadRun(fixture, scenario), [fixture, scenario]);
  const presentation = useMemo(() => buildRunPresentation(fixture, scenario, evidence), [fixture, scenario, evidence]);
  const visibleSteps = presentation.trace.slice(0, runState.visibleTraceSteps);
  const visibleReceipts = visibleSteps.filter((step) => step.transaction);
  const isComplete = runState.stage === "complete";
  const isActive = runState.stage === "running" || runState.stage === "analyzing";
  const successfulReceipts = evidence.transactions.filter((item) => item.status === "success").length;
  const matchedEvents = evidence.matchingEvents.length;
  const invariantCount = evidence.invariantResults.length;
  const passedInvariants = evidence.invariantResults.filter((item) => item.passed).length;

  useEffect(() => {
    if (runState.stage !== "running") return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timer = window.setTimeout(() => dispatch({ type: "advance-trace", total: presentation.trace.length }), reducedMotion ? 40 : 520);
    return () => window.clearTimeout(timer);
  }, [presentation.trace.length, runState.stage, runState.visibleTraceSteps]);

  useEffect(() => {
    if (runState.stage !== "analyzing") return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timer = window.setTimeout(() => dispatch({ type: "advance-analysis", total: 4 }), reducedMotion ? 45 : 850);
    return () => window.clearTimeout(timer);
  }, [runState.stage, runState.visibleAnalysisSteps]);

  useEffect(() => {
    const targetId = runState.stage === "complete" ? "verdict-section" : runState.stage === "running" ? "execution-section" : null;
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target || typeof target.scrollIntoView !== "function") return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, [runState.stage]);

  function resetReplay() {
    dispatch({ type: "reset" });
  }

  function selectFixture(next: Fixture) {
    setFixture(next);
    resetReplay();
  }

  function selectScenario(next: ScenarioKey) {
    setScenario(next);
    resetReplay();
  }

  return (
    <main className="site-shell" id="top">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="Sazume home"><BrandMark /><span>SAZUME</span></a>
        <span className="brand-purpose">ECONOMIC RELIABILITY TESTING</span>
        <div className="network-proof"><span>{evidence.network.toUpperCase()}</span><i aria-hidden="true">/</i><span>VERIFIED EVIDENCE</span></div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title"><span>THE TRANSACTION</span><span>SUCCEEDED.</span><span>DID THE</span><span>MONEY?</span></h1>
        <div className="hero-aside">
          <span className="hero-rule" aria-hidden="true" />
          <p>Economic reliability testing<br />for programmable money.</p>
        </div>
      </section>

      <section className="experiment" aria-labelledby="intent-heading">
        <div className="section-label"><span>TEST SPECIFICATION</span><span>REPLAY · NO BROWSER TRANSACTION</span></div>

        <div className="intent-definition">
          <div className="intent-name"><span className="field-label">ECONOMIC INTENT</span><h2 id="intent-heading">PAY RECIPIENT<br />EXACTLY ONCE</h2></div>
          <div className="intent-amount"><span className="field-label">QUALIFICATION AMOUNT</span><strong>{formatUsdc6(evidence.qualificationAmountUsdc6)} <small>USDC</small></strong></div>
          <div className="intent-limit"><span className="field-label">SETTLEMENTS</span><strong>≤ 1</strong></div>
          <div className="intent-limit"><span className="field-label">FULFILLMENTS</span><strong>≤ 1</strong></div>
        </div>

        <div className="configuration-grid">
          <fieldset className="choice-group implementation-group" disabled={isActive}>
            <legend>IMPLEMENTATION</legend>
            <div className="choice-pair" role="group" aria-label="Application implementation">
              <button type="button" aria-pressed={fixture === "unsafe"} onClick={() => selectFixture("unsafe")} className={fixture === "unsafe" ? "choice-active" : ""}>
                <span className="choice-state">{fixture === "unsafe" ? "●" : "○"}</span><strong>UNSAFE</strong><small>No settlement idempotency.</small>
              </button>
              <button type="button" aria-pressed={fixture === "fixed"} onClick={() => selectFixture("fixed")} className={fixture === "fixed" ? "choice-active" : ""}>
                <span className="choice-state">{fixture === "fixed" ? "●" : "○"}</span><strong>IDEMPOTENT</strong><small>Duplicate intent prevented.</small>
              </button>
            </div>
          </fieldset>

          <fieldset className="choice-group failure-group" disabled={isActive}>
            <legend>FAILURE INJECTION</legend>
            <div className="scenario-choices" role="group" aria-label="Failure scenario">
              {scenarios.map((item) => (
                <button key={item.id} type="button" aria-pressed={scenario === item.id} onClick={() => selectScenario(item.id)} className={scenario === item.id ? "scenario-active" : ""}>
                  <span className="scenario-check" aria-hidden="true">{scenario === item.id ? "✓" : "—"}</span><span><strong>{item.title}</strong><small>{item.description}</small></span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="experiment-actions">
          <button type="button" className="run-button" onClick={() => dispatch({ type: "start" })} disabled={isActive}>
            <span>{isActive ? "RUNNING" : isComplete ? "REPLAY TEST" : "RUN ECONOMIC TEST"}</span><span aria-hidden="true">→</span>
          </button>
          {runState.stage !== "configure" && <button className="reset-button" type="button" onClick={resetReplay}>RESET EXPERIMENT</button>}
          <span className="run-mode-copy">VERIFIED EVIDENCE REPLAY<br />This replays a previously executed Arc Testnet run. No new transaction is broadcast from this browser.</span>
        </div>
      </section>

      <section className="execution" id="execution-section" aria-labelledby="execution-title">
        <div className="execution-heading">
          <div><span className="field-label">OBSERVED EXECUTION</span><h2 id="execution-title">{runState.stage === "configure" ? "READY TO REPLAY SELECTED EVIDENCE." : scenarioLabels[scenario]}</h2></div>
          <span className="execution-state" aria-live="polite">{runState.stage === "configure" ? "READY" : runState.stage === "running" ? "EXECUTING" : runState.stage === "analyzing" ? "RECONCILING" : "COMPLETE"}</span>
        </div>

        {runState.stage === "configure" ? (
          <div className="execution-empty"><span aria-hidden="true">—</span><p>Run the selected experiment to reveal its recorded execution and economic outcome.</p></div>
        ) : (
          <>
            <div className="replay-clock-note">SEQUENCE CLOCK / PRESENTATION TIMING · NOT HISTORICAL CHAIN LATENCY</div>
            <ExecutionTimeline steps={visibleSteps} stage={runState.stage} />
            {visibleReceipts.length > 0 && (
              <IntentBranches
                intentId={evidence.intent.intentId}
                humanId={evidence.intent.humanId}
                amountUsdc6={evidence.qualificationAmountUsdc6}
                receipts={visibleReceipts}
                evidence={evidence}
                complete={isComplete}
              />
            )}
            {runState.stage === "analyzing" && (
              <div className="reconciliation" aria-live="polite">
                <h3>RECONCILING ECONOMIC OUTCOME</h3>
                <div className="reconciliation-rows">
                  {[
                    `Receipts · ${successfulReceipts} successful`,
                    `Settlement events · ${matchedEvents} matched`,
                    `Recipient balance · +${formatUsdc6(evidence.recipientDeltaUsdc6)} USDC observed`,
                    `Invariants · ${passedInvariants} / ${invariantCount} preserved`,
                  ].slice(0, runState.visibleAnalysisSteps + 1).map((row, index) => <p key={row}><span>{index < runState.visibleAnalysisSteps ? "✓" : "○"}</span>{row}</p>)}
                </div>
              </div>
            )}
            {isComplete && <div className="blockchain-summary"><span>BLOCKCHAIN EXECUTION</span><strong>{successfulReceipts} SUCCESSFUL RECEIPTS</strong><span>Economic correctness is evaluated separately.</span></div>}
          </>
        )}
      </section>

      {isComplete && (
        <>
          <EconomicVerdict evidence={evidence} />
          <ProofInspector evidence={evidence} />
        </>
      )}

      <section className="editorial-section distinction" aria-labelledby="distinction-title">
        <p className="editorial-overline">A RECEIPT IS A RECORD OF EXECUTION.</p>
        <h2 id="distinction-title">A SUCCESSFUL TRANSACTION<br />IS NOT A SUCCESSFUL PAYMENT.</h2>
        <div className="correctness-contrast">
          <div><span>BLOCKCHAIN CORRECTNESS</span><strong>Did the transaction execute?</strong></div>
          <span className="contrast-divider" aria-hidden="true">≠</span>
          <div><span>ECONOMIC CORRECTNESS</span><strong>Did the obligation remain intact?</strong></div>
        </div>
      </section>

      <section className="editorial-section evidence-principle" aria-labelledby="verify-title">
        <h2 id="verify-title">DON’T TRUST<br />THE VERDICT.</h2>
        <div><p>Verify it.</p><span>RECEIPT <b>=</b> EVENT <b>=</b> ECONOMIC MOVEMENT</span></div>
      </section>

      <section className="method-section" aria-labelledby="method-title">
        <div><span className="field-label">THE METHOD</span><h2 id="method-title">ONE ECONOMIC INTENT.<br />ONE OBSERVED OUTCOME.</h2></div>
        <ol className="method-flow">
          {["ECONOMIC INTENT", "SCENARIO", "APPLICATION ADAPTER", "ECONOMIC OUTCOME", "INVARIANT ENGINE", "VERDICT"].map((step, index) => <li key={step}><span>{step}</span>{index < 5 && <i aria-hidden="true">→</i>}</li>)}
        </ol>
      </section>

      <QualificationSection scenario={scenario} />

      <footer className="site-footer">
        <a className="footer-brand" href="#top"><BrandMark /><span>SAZUME</span></a>
        <p>Economic reliability testing for programmable money.</p>
        <div><span>MAINNET</span><strong>NOT DEPLOYED</strong></div>
        <span className="footer-evidence">VERIFIED EVIDENCE · ARC TESTNET</span>
      </footer>
      <div className="sr-only" aria-live="polite">{isComplete ? `Replay complete. Economic intent ${evidence.verdict === "PASS" ? "preserved" : "not preserved"}.` : ""}</div>
    </main>
  );
}
