import { useEffect, useMemo, useReducer, useState } from "react";
import matrixEvidence from "../../../evidence/testnet/full-matrix.json";
import {
  abbreviate,
  formatUsdc6,
  testnetEvidenceProvider,
  type Fixture,
  type ScenarioKey,
} from "./lib/evidenceProvider.js";
import { buildRunPresentation } from "./lib/presentation.js";
import { initialRunState, runMachineReducer } from "./lib/runMachine.js";

const scenarios: Array<{ id: ScenarioKey; number: string; title: string; description: string }> = [
  { id: "normal", number: "01", title: "NORMAL", description: "Settle once, then fulfill." },
  { id: "timeout-before-settlement", number: "02", title: "TIMEOUT / BEFORE SETTLEMENT", description: "The request expires before payment commits." },
  { id: "timeout-after-settlement", number: "03", title: "TIMEOUT / AFTER SETTLEMENT", description: "Payment commits; its acknowledgement disappears." },
  { id: "duplicate-callback", number: "04", title: "DUPLICATE CALLBACK", description: "The fulfillment callback arrives twice." },
];

const invariantDescriptions: Record<string, string> = {
  "Settlement uniqueness": "One economic intent may settle at most once.",
  "Recipient amount": "A completed intent delivers exactly the intended amount.",
  "Fulfillment uniqueness": "The paid service may be fulfilled at most once.",
  "Completion consistency": "Completion requires both settlement and fulfillment.",
};

const scenarioLabels: Record<ScenarioKey, string> = {
  normal: "NORMAL",
  "timeout-before-settlement": "TIMEOUT BEFORE SETTLEMENT",
  "timeout-after-settlement": "TIMEOUT AFTER SETTLEMENT",
  "duplicate-callback": "DUPLICATE CALLBACK",
};

const fixtureResults = matrixEvidence.outcomes as Array<{ fixture: Fixture; scenario: ScenarioKey; result: "PASS" | "FAIL" }>;

function formatGwei(wei: string): string {
  const value = BigInt(wei);
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, "0").slice(0, 3);
  return `${whole}.${fraction} Gwei`;
}

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
      <span>{copied ? "COPIED" : abbreviate(value, 10, 7)}</span>
      <span className="copy-mark" aria-hidden="true">{copied ? "✓" : "↗"}</span>
    </button>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M5 25.5 12.2 8.5h5.3l-7.1 17H5Z" />
      <path d="M15.8 25.5 22.9 8.5h5.2l-7.1 17h-5.2Z" />
      <path d="M10.1 17h13.8" />
    </svg>
  );
}

export default function App() {
  const [fixture, setFixture] = useState<Fixture>("unsafe");
  const [scenario, setScenario] = useState<ScenarioKey>("timeout-after-settlement");
  const [runState, dispatch] = useReducer(runMachineReducer, initialRunState);
  const presentation = useMemo(
    () => buildRunPresentation(fixture, scenario, testnetEvidenceProvider.loadRun(fixture, scenario)),
    [fixture, scenario],
  );
  const evidence = presentation.evidence;

  useEffect(() => {
    if (runState.stage !== "running") return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timer = window.setTimeout(
      () => dispatch({ type: "advance-trace", total: presentation.trace.length }),
      reducedMotion ? 35 : 510,
    );
    return () => window.clearTimeout(timer);
  }, [presentation.trace.length, runState.stage, runState.visibleTraceSteps]);

  useEffect(() => {
    if (runState.stage !== "analyzing") return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timer = window.setTimeout(
      () => dispatch({ type: "advance-analysis", total: 4 }),
      reducedMotion ? 35 : 620,
    );
    return () => window.clearTimeout(timer);
  }, [runState.stage, runState.visibleAnalysisSteps]);

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

  function runReplay() {
    dispatch({ type: "start" });
  }

  const successReceipts = evidence.transactions.filter((item) => item.status === "success").length;
  const revertedReceipts = evidence.transactions.filter((item) => item.status === "reverted").length;
  const matchingEvents = evidence.matchingEvents.length;
  const verdictFailed = evidence.verdict === "FAIL";
  const isComplete = runState.stage === "complete";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#top" aria-label="Sazume home">
          <BrandMark />
          <span className="brand-name">SAZUME</span>
          <span className="brand-divider" />
          <span className="brand-descriptor">ECONOMIC RELIABILITY TESTING</span>
        </a>
        <div className="topbar-status" aria-label="Verified Arc Testnet evidence replay">
          <span className="status-dot" />
          <span>VERIFIED EVIDENCE REPLAY</span>
          <span className="status-divider" />
          <span className="network-label">ARC TESTNET <span>· 5042002</span></span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span>01</span> ECONOMIC RELIABILITY / PAYMENT WORKFLOWS</p>
          <h1>THE TRANSACTION<br />SUCCEEDED.<br /><span>DID THE MONEY?</span></h1>
          <p className="hero-subtitle">Economic reliability testing<br />for programmable money.</p>
        </div>
        <div className="hero-instrument" aria-label="Replay metadata">
          <div className="instrument-heading"><span>SAZUME / RUNNER</span><span>v0.1</span></div>
        <div className="instrument-row"><span>NETWORK</span><strong>ARC TESTNET</strong></div>
        <div className="instrument-row"><span>STATUS</span><strong>VERIFIED EVIDENCE</strong></div>
        <div className="instrument-foot"><span>MODE</span><strong>REPLAY · NO BROADCAST</strong></div>
        </div>
      </section>

      <div className="replay-banner">
        <span className="replay-icon" aria-hidden="true">↻</span>
        <span><strong>VERIFIED EVIDENCE REPLAY.</strong> Replaying a previously verified Arc Testnet execution. No transaction is broadcast from this browser.</span>
        <span className="replay-ref">ARC TESTNET · 5042002</span>
      </div>

      <section className="workbench" aria-label="Sazume reliability experiment">
        <aside className="control-panel">
          <div className="section-kicker"><span>01</span> DEFINE THE TEST</div>

          <section className="intent-block" aria-labelledby="intent-title">
            <div className="block-title-row"><h2 id="intent-title">ECONOMIC INTENT</h2><span className="live-tag">USDC6</span></div>
            <p className="intent-statement">PAY RECIPIENT<br />EXACTLY ONCE</p>
            <div className="intent-value-row">
              <div><span>OBLIGATION</span><strong>{formatUsdc6(evidence.qualificationAmountUsdc6)} <small>USDC</small></strong></div>
              <div><span>SETTLEMENTS</span><strong>≤ 1</strong></div>
            </div>
            {runState.stage === "configure" ? <p className="intent-human-id">VERIFIED QUALIFICATION · 0.010000 USDC</p> : <div className="intent-id-row"><span>SAME ECONOMIC INTENT</span><CopyValue value={evidence.intent.intentId} label="economic intent ID" /></div>}
          </section>

          <section className="fixture-block" aria-labelledby="fixture-title">
            <div className="section-heading-line"><h2 id="fixture-title">IMPLEMENTATION UNDER TEST</h2><span>SELECT ONE</span></div>
            <div className="fixture-switch" role="group" aria-label="Application implementation">
              <button type="button" disabled={runState.stage === "running" || runState.stage === "analyzing"} aria-pressed={fixture === "unsafe"} onClick={() => selectFixture("unsafe")} className={fixture === "unsafe" ? "selected unsafe-selected" : ""}>
                <span className="switch-indicator" /> UNSAFE <small>No settlement idempotency.</small>
              </button>
              <button type="button" disabled={runState.stage === "running" || runState.stage === "analyzing"} aria-pressed={fixture === "fixed"} onClick={() => selectFixture("fixed")} className={fixture === "fixed" ? "selected fixed-selected" : ""}>
                <span className="switch-indicator" /> IDEMPOTENT <small>Duplicate intent prevented.</small>
              </button>
            </div>
          </section>

          <section className="scenario-block" aria-labelledby="scenario-title">
            <div className="section-heading-line"><h2 id="scenario-title">FAULT INJECTION</h2><span>4 SCENARIOS</span></div>
            <div className="scenario-list" role="group" aria-label="Failure scenario">
              {scenarios.map((item) => (
                <button key={item.id} type="button" disabled={runState.stage === "running" || runState.stage === "analyzing"} aria-pressed={scenario === item.id} onClick={() => selectScenario(item.id)} className={`scenario-option ${scenario === item.id ? "scenario-selected" : ""}`}>
                  <span className="scenario-number">{item.number}</span>
                  <span className="scenario-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                  <span className="scenario-chevron" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </section>

          <div className="run-actions">
            <button type="button" className="run-button" onClick={runReplay} disabled={runState.stage === "running" || runState.stage === "analyzing"}>
              <span className={runState.stage === "running" || runState.stage === "analyzing" ? "run-spinner" : "run-symbol"} aria-hidden="true">{runState.stage === "running" || runState.stage === "analyzing" ? "" : "▶"}</span>
              {runState.stage === "running" ? "EXECUTING REPLAY" : runState.stage === "analyzing" ? "ANALYZING OUTCOME" : isComplete ? "RUN ECONOMIC TEST AGAIN" : "RUN ECONOMIC TEST"}
              <span className="run-arrow" aria-hidden="true">↗</span>
            </button>
            {runState.stage !== "configure" && <button type="button" className="reset-button" onClick={resetReplay}>RESET EXPERIMENT</button>}
          </div>
          <p className="replay-note"><span>i</span> This replays a verified run. Browser actions never submit transactions.</p>
        </aside>

        <section className="trace-panel" aria-labelledby="trace-title">
          <div className="trace-toolbar">
            <div>
              <div className="section-kicker"><span>02</span> OBSERVE EXECUTION</div>
              <h2 id="trace-title">EXECUTION TRACE <span>/ {scenarioLabels[scenario]}</span></h2>
            </div>
            <div className={`run-state-chip ${runState.stage}`} aria-live="polite"><span />{runState.stage === "configure" ? "CONFIGURE" : runState.stage === "running" ? "EXECUTING REPLAY" : runState.stage === "analyzing" ? "RECONCILING OUTCOME" : "ANALYSIS COMPLETE"}</div>
          </div>

          <div className={`trace-console ${isComplete ? "trace-complete" : ""}`} aria-live="polite" aria-label="Execution trace">
            <div className="console-header"><span>ARC / REPLAY OBSERVER</span><span>{runState.stage === "configure" ? "AWAITING RUN" : `${String(Math.min(runState.visibleTraceSteps, presentation.trace.length)).padStart(2, "0")} / ${String(presentation.trace.length).padStart(2, "0")} EVENTS`}</span></div>
            {runState.stage === "configure" ? (
              <div className="trace-empty">
                <div className="trace-empty-glyph" aria-hidden="true"><span /><span /><span /><span /></div>
                <p>Run the selected experiment to inspect<br />the verified execution sequence.</p>
                <span className="empty-network">STATIC TESTNET EVIDENCE · NO RPC REQUEST</span>
              </div>
            ) : (
              <ol className="trace-list">
                {presentation.trace.slice(0, runState.visibleTraceSteps).map((step, index) => (
                  <li key={step.key} className={`trace-step tone-${step.tone} ${index === runState.visibleTraceSteps - 1 && runState.stage === "running" ? "trace-active" : ""}`}>
                    <span className="trace-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="trace-marker" aria-hidden="true">{step.tone === "success" ? "✓" : step.tone === "danger" ? "×" : step.tone === "warning" ? "!" : "›"}</span>
                    <span className="trace-step-copy"><strong>{step.label}</strong><small>{step.detail}</small></span>
                    {step.tag && <span className={`trace-tag tag-${step.tone}`}>{step.tag}</span>}
                  </li>
                ))}
                {runState.stage === "running" && <li className="trace-cursor"><span /> Replaying recorded evidence…</li>}
              </ol>
            )}
            <div className="console-footer"><span>INTENT <code>{abbreviate(evidence.intent.intentId, 12, 8)}</code></span><span>RECEIPT FINALITY <b>INCLUDED</b></span></div>
          </div>

          {runState.stage === "analyzing" && (
            <div className="analysis-sequence" aria-live="polite">
              {[
                `Receipts · ${successReceipts} successful`,
                `Settlement events · ${matchingEvents} matched`,
                `Recipient balance · +${formatUsdc6(evidence.recipientDeltaUsdc6)} USDC`,
                "Evaluating economic invariants",
              ].slice(0, runState.visibleAnalysisSteps + 1).map((label, index) => (
                <div className="analysis-step" key={label}><span>{index < runState.visibleAnalysisSteps ? "✓" : "◌"}</span>{label}</div>
              ))}
            </div>
          )}

          {isComplete && (
            <div className={`receipt-strip ${verdictFailed ? "receipt-strip-fail" : "receipt-strip-pass"}`}>
              <div className="receipt-strip-label"><span>BLOCKCHAIN STATUS</span><strong>RECEIPTS RECORDED</strong></div>
              <div className="receipt-tally success-tally"><b>✓</b><strong>{successReceipts}</strong><span>SUCCESS</span></div>
              {revertedReceipts > 0 && <div className="receipt-tally revert-tally"><b>↩</b><strong>{revertedReceipts}</strong><span>REVERTED</span></div>}
              <div className="receipt-strip-note">Receipt status remains separate<br />from the economic verdict.</div>
            </div>
          )}
        </section>
      </section>

      {isComplete && (
        <>
          <section className={`verdict-section ${verdictFailed ? "verdict-fail" : "verdict-pass"}`} aria-labelledby="verdict-title">
            <div className="verdict-lead">
              <div className="section-kicker"><span>03</span> ECONOMIC VERDICT</div>
              <div className="verdict-word">{evidence.verdict}</div>
              <h2 id="verdict-title">ECONOMIC INTENT<br />{verdictFailed ? "NOT PRESERVED" : "PRESERVED"}</h2>
              <p>{verdictFailed ? "Both transactions succeeded. The economic intent failed." : fixture === "fixed" && scenario === "timeout-after-settlement" ? "The retry carried the same intent. The second transfer was prevented." : "Observed execution preserved the stated economic intent."}</p>
            </div>
            <div className="invariant-area">
              <div className="invariant-heading"><span>INVARIANT EVALUATION</span><span>{evidence.invariantResults.filter((item) => item.passed).length} / {evidence.invariantResults.length} PRESERVED</span></div>
              <div className="invariant-list">
                {evidence.invariantResults.map((item) => (
                  <article key={item.name} className={`invariant-row ${item.passed ? "invariant-pass" : "invariant-fail"}`}>
                    <span className="invariant-state" aria-label={item.passed ? "Preserved" : "Violated"}>{item.passed ? "✓" : "×"}</span>
                    <div className="invariant-name"><strong>{item.name}</strong><small>{invariantDescriptions[item.name] ?? item.message ?? "Economic invariant."}</small></div>
                    <div className="invariant-values"><span>EXPECTED <b>{item.name === "Recipient amount" ? `${formatUsdc6(evidence.qualificationAmountUsdc6)} USDC` : item.expected}</b></span><span>OBSERVED <b>{item.name === "Recipient amount" ? `${formatUsdc6(evidence.observedSettlementAmountUsdc6)} USDC` : item.observed}</b></span></div>
                    <span className="invariant-result">{item.passed ? "PRESERVED" : "VIOLATED"}</span>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="proof-section" aria-labelledby="proof-title">
            <div className="proof-heading">
              <div><div className="section-kicker"><span>04</span> ECONOMIC CORROBORATION</div><h2 id="proof-title">PROVE THE OUTCOME.</h2></div>
              <div className="corroboration-badge"><span>✓</span> RECEIPT = EVENT = BALANCE MOVEMENT</div>
            </div>
            <div className="proof-grid">
              <article className="proof-cell"><div className="proof-cell-top"><span className="proof-number">A</span><span className="proof-check">✓ VERIFIED</span></div><h3>TRANSACTION RECEIPTS</h3><strong>{successReceipts} SUCCESS<span>{revertedReceipts > 0 ? ` · ${revertedReceipts} REVERTED` : ""}</span></strong><p>Successful chain execution is recorded independently of Sazume's economic verdict.</p></article>
              <article className="proof-cell"><div className="proof-cell-top"><span className="proof-number">B</span><span className="proof-check">✓ VERIFIED</span></div><h3>SETTLEMENT EVENTS</h3><strong>{matchingEvents} MATCHING<span> / {evidence.settlementAttempts} ATTEMPTS</span></strong><p>Intent, payer, recipient, and USDC6 amounts match the observed settlement records.</p></article>
              <article className="proof-cell proof-balance"><div className="proof-cell-top"><span className="proof-number">C</span><span className="proof-check">✓ VERIFIED</span></div><h3>RECIPIENT BALANCE DELTA</h3><strong>+{formatUsdc6(evidence.recipientDeltaUsdc6)}<span> USDC</span></strong><p>{formatUsdc6(evidence.recipientBalanceBeforeUsdc6)} before <span className="arrow-inline">→</span> {formatUsdc6(evidence.recipientBalanceAfterUsdc6)} after</p></article>
            </div>

            <div className="evidence-meta">
              <div className="evidence-meta-cell"><span>INTENT / SAME ON RETRY</span><div><CopyValue value={evidence.intent.intentId} label="intent ID" /></div></div>
              <div className="evidence-meta-cell"><span>SETTLEMENT CONTRACT</span><div><CopyValue value={evidence.contract} label="settlement contract address" /></div></div>
              <div className="evidence-meta-cell"><span>QUALIFICATION AMOUNT</span><strong>{formatUsdc6(evidence.qualificationAmountUsdc6)} USDC <small>({evidence.qualificationAmountUsdc6} USDC6)</small></strong></div>
              <div className="evidence-meta-cell"><span>RECIPIENT</span><div><CopyValue value={evidence.recipientAddress} label="recipient address" /></div></div>
            </div>

            <div className="transaction-table-wrap">
              <div className="transaction-table-heading"><h3>VERIFIED TRANSACTIONS</h3><span>{evidence.transactions.length} TX · ARC TESTNET</span></div>
              <div className="transaction-table" role="table" aria-label="Verified Arc Testnet transactions">
                <div className="transaction-head" role="row"><span>TRANSACTION</span><span>RECEIPT</span><span>BLOCK</span><span>GAS USED</span><span>EFFECTIVE PRICE</span><span>GAS COST</span></div>
                {evidence.transactions.map((tx, index) => (
                  <div className="transaction-row" role="row" key={tx.hash}>
                    <div className="transaction-hash" role="cell"><a href={`https://explorer.testnet.arc.io/tx/${tx.hash}`} target="_blank" rel="noreferrer" aria-label={`Open transaction ${tx.hash} in Arc Testnet explorer`}>{abbreviate(tx.hash, 10, 8)} <span aria-hidden="true">↗</span></a><CopyValue value={tx.hash} label={`transaction ${index + 1} hash`} /></div>
                    <span className={`tx-status ${tx.status}`} role="cell"><i />{tx.status.toUpperCase()}</span>
                    <span className="mono-cell" role="cell">{tx.blockNumber}</span>
                    <span className="mono-cell" role="cell">{Number(tx.gasUsed).toLocaleString("en-US")}</span>
                    <span className="mono-cell" role="cell">{formatGwei(tx.effectiveGasPrice)}</span>
                    <span className="mono-cell gas-cost" role="cell">{formatUsdc6(tx.gasCostUsdc6)} <small>USDC</small></span>
                  </div>
                ))}
              </div>
              <p className="transaction-footnote">Gas is reported in native USDC18 and normalized to USDC6 for display. The raw native18 values remain in the verified run records.</p>
            </div>
          </section>
        </>
      )}

      {isComplete && <details className="qualification-disclosure"><summary>VALIDATION / QUALIFICATION MATRIX</summary><section className="matrix-section" aria-labelledby="matrix-title">
        <div className="matrix-heading"><div><div className="section-kicker"><span>05</span> QUALIFICATION RECORD</div><h2 id="matrix-title">THE BEHAVIORAL MATRIX</h2></div><span>LIVE ARC TESTNET · VERIFIED EVIDENCE</span></div>
        <div className="matrix-table" role="table" aria-label="Arc Testnet qualification matrix">
          <div className="matrix-row matrix-head" role="row"><span>SCENARIO</span><span>UNSAFE</span><span>FIXED</span></div>
          {scenarios.map((item) => {
            const unsafe = fixtureResults.find((row) => row.fixture === "unsafe" && row.scenario === item.id)?.result;
            const fixed = fixtureResults.find((row) => row.fixture === "fixed" && row.scenario === item.id)?.result;
            return <div className={`matrix-row ${scenario === item.id ? "matrix-current" : ""}`} role="row" key={item.id}><span>{item.title}</span><span className={unsafe === "PASS" ? "matrix-pass" : "matrix-fail"}><i>{unsafe === "PASS" ? "✓" : "×"}</i> {unsafe}</span><span className="matrix-pass"><i>✓</i> {fixed}</span></div>;
          })}
        </div>
      </section></details>}

      <footer className="site-footer">
        <div className="footer-brand"><BrandMark /><span>SAZUME</span></div>
        <p>Economic reliability testing for programmable money.</p>
        <div className="footer-status"><span>MAINNET</span><strong>NOT DEPLOYED</strong></div>
        <span className="footer-version">EVIDENCE SNAPSHOT · ARC TESTNET · 0.1</span>
      </footer>
      <div className="sr-only" aria-live="polite">{isComplete ? `Replay complete. Economic intent ${evidence.verdict === "PASS" ? "preserved" : "not preserved"}.` : ""}</div>
    </main>
  );
}
