import type { RunEvidence } from "../lib/evidenceProvider.js";
import { formatUsdc6 } from "../lib/evidenceProvider.js";

export function EconomicVerdict({ evidence }: { evidence: RunEvidence }) {
  const failed = evidence.verdict === "FAIL";
  const bothReceiptsSucceeded = evidence.transactions.length > 1
    && evidence.transactions.every((transaction) => transaction.status === "success");
  const explanation = failed
    ? bothReceiptsSucceeded
      ? "Both blockchain transactions succeeded. The economic outcome did not."
      : "The recorded execution violated one or more economic invariants."
    : evidence.revertedReceipts > 0 && evidence.observedSettlementCount === 1
      ? "The duplicate retry reverted. One settlement preserved the intent."
      : "The observed execution preserved the stated economic intent.";

  return (
    <section className={`verdict-section ${failed ? "verdict-fail" : "verdict-pass"}`} aria-labelledby="verdict-title">
      <div className="verdict-lead">
        <div className="section-kicker"><span>03</span> ECONOMIC VERDICT</div>
        <div className="verdict-word">{evidence.verdict}</div>
        <h2 id="verdict-title">ECONOMIC INTENT<br />{failed ? "NOT PRESERVED" : "PRESERVED"}</h2>
        <p>{explanation}</p>
      </div>
      <div className="invariant-area">
        <div className="invariant-heading"><span>INVARIANT EVALUATION</span><span>{evidence.invariantResults.filter((item) => item.passed).length} / {evidence.invariantResults.length} PRESERVED</span></div>
        <div className="invariant-list">
          {evidence.invariantResults.map((item) => (
            <article key={item.name} className={`invariant-row ${item.passed ? "invariant-pass" : "invariant-fail"}`}>
              <span className="invariant-state" aria-label={item.passed ? "Preserved" : "Violated"}>{item.passed ? "✓" : "×"}</span>
              <div className="invariant-name"><strong>{item.name}</strong><small>{item.message ?? "Economic invariant evaluated against observed outcome."}</small></div>
              <div className="invariant-values">
                <span>EXPECTED <b>{item.name === "Recipient amount" ? `${formatUsdc6(evidence.qualificationAmountUsdc6)} USDC` : item.expected}</b></span>
                <span>OBSERVED <b>{item.name === "Recipient amount" ? `${formatUsdc6(evidence.observedSettlementAmountUsdc6)} USDC` : item.observed}</b></span>
              </div>
              <span className="invariant-result">{item.passed ? "PRESERVED" : "VIOLATED"}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
