import type { RunEvidence } from "../lib/evidenceProvider.js";
import { formatUsdc6 } from "../lib/evidenceProvider.js";

export function EconomicVerdict({ evidence }: { evidence: RunEvidence }) {
  const failed = evidence.verdict === "FAIL";
  const successfulTransactions = evidence.transactions.filter((transaction) => transaction.status === "success").length;
  const explanation = failed
    ? successfulTransactions > 1
      ? "Both blockchain transactions succeeded. The economic outcome did not."
      : "The recorded execution violated one or more economic invariants."
    : evidence.revertedReceipts > 0 && evidence.observedSettlementCount === 1
      ? "The duplicate retry was prevented. One settlement preserved the intent."
      : "The observed execution preserved the stated economic intent.";

  return (
    <section id="verdict-section" className={`verdict-section ${failed ? "verdict-fail" : "verdict-pass"}`} aria-labelledby="verdict-title">
      <div className="verdict-topline"><span>ECONOMIC VERDICT</span><code>{evidence.intent.humanId}</code></div>
      <div className="verdict-main">
        <div className="verdict-message">
          <span className="verdict-symbol" aria-hidden="true">{failed ? "×" : "✓"}</span>
          <h2 id="verdict-title">ECONOMIC INTENT<br /><strong>{failed ? "NOT" : ""} PRESERVED.</strong></h2>
          <p>{explanation}</p>
        </div>
        <div className="verdict-measurements">
          <div><span>SUCCESSFUL TRANSACTIONS</span><strong>{String(successfulTransactions).padStart(2, "0")}</strong></div>
          <div><span>INTENDED OBLIGATIONS</span><strong>01</strong></div>
          <div><span>OBSERVED SETTLEMENTS</span><strong>{String(evidence.observedSettlementCount).padStart(2, "0")}</strong></div>
          <div><span>RECIPIENT BALANCE DELTA</span><strong>{formatUsdc6(evidence.recipientDeltaUsdc6)} <small>USDC</small></strong></div>
        </div>
      </div>
      <div className="invariant-list">
        <div className="invariant-list-heading"><span>ECONOMIC INVARIANTS</span><span>{evidence.invariantResults.filter((item) => item.passed).length} / {evidence.invariantResults.length} PRESERVED</span></div>
        {evidence.invariantResults.map((item) => (
          <article key={item.name} className="invariant-row">
            <span className="invariant-state" aria-label={item.passed ? "Preserved" : "Violated"}>{item.passed ? "✓" : "×"}</span>
            <div className="invariant-name"><strong>{item.name}</strong><small>{item.message ?? "Economic invariant evaluated against observed outcome."}</small></div>
            <div className="invariant-values"><span>EXPECTED <b>{item.name === "Recipient amount" ? `${formatUsdc6(evidence.qualificationAmountUsdc6)} USDC` : item.expected}</b></span><span>OBSERVED <b>{item.name === "Recipient amount" ? `${formatUsdc6(evidence.observedSettlementAmountUsdc6)} USDC` : item.observed}</b></span></div>
            <span className="invariant-result">{item.passed ? "PRESERVED" : "VIOLATED"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
