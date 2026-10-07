import { useState } from "react";
import type { RunEvidence } from "../lib/evidenceProvider.js";
import { formatUsdc6 } from "../lib/evidenceProvider.js";

function formatGwei(wei: string): string {
  const value = BigInt(wei);
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, "0").slice(0, 3);
  return `${whole}.${fraction} Gwei`;
}

function CopyEvidence({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_400);
    } catch {
      setCopied(false);
    }
  }

  return <button className="copy-evidence" type="button" onClick={copy} aria-label={`Copy ${label}`}>{copied ? "COPIED ✓" : "COPY"}</button>;
}

export function ProofInspector({ evidence }: { evidence: RunEvidence }) {
  const successfulReceipts = evidence.transactions.filter((transaction) => transaction.status === "success").length;
  return (
    <section className="proof-section" aria-labelledby="proof-title">
      <div className="proof-heading">
        <div><span className="field-label">INDEPENDENT VERIFICATION</span><h2 id="proof-title">DON’T TRUST THE VERDICT.<br /><strong>VERIFY IT.</strong></h2></div>
        <p className="proof-equation">RECEIPT <b>=</b> EVENT <b>=</b> ECONOMIC MOVEMENT</p>
      </div>
      <div className="proof-grid">
        <article className="proof-cell"><div className="proof-cell-top"><span>RECEIPTS</span><strong>{successfulReceipts} / {evidence.transactions.length} SUCCESSFUL</strong></div><p>Blockchain execution. Economic correctness is evaluated separately.</p></article>
        <article className="proof-cell"><div className="proof-cell-top"><span>SETTLEMENT EVENTS</span><strong>{evidence.matchingEvents.length} / {evidence.settlementAttempts} MATCHED</strong></div><p>Intent, payer, recipient, and USDC6 match the recorded events.</p></article>
        <article className="proof-cell proof-balance"><div className="proof-cell-top"><span>RECIPIENT BALANCE</span><strong>DELTA</strong></div><p className="balance-delta">+{formatUsdc6(evidence.recipientDeltaUsdc6)} <small>USDC</small></p><p>{formatUsdc6(evidence.recipientBalanceBeforeUsdc6)} before <span className="arrow-inline">→</span> {formatUsdc6(evidence.recipientBalanceAfterUsdc6)} after</p></article>
      </div>

      <div className="proof-identities">
        <div><span>ECONOMIC INTENT</span><code>{evidence.intent.humanId}</code><code>{evidence.intent.intentId}</code></div>
        <div><span>CONTRACT</span><code>{evidence.contract}</code></div>
        <div><span>RECIPIENT</span><code>{evidence.recipientAddress}</code></div>
        <div><span>QUALIFICATION AMOUNT</span><strong>{formatUsdc6(evidence.qualificationAmountUsdc6)} USDC</strong></div>
      </div>

      <div className="transaction-inspector">
        <div className="transaction-table-heading"><h3>ARC TESTNET TRANSACTIONS</h3><span>{evidence.transactions.length} RECEIPTS · BLOCKS {evidence.transactions.map((transaction) => transaction.blockNumber).join(" / ")}</span></div>
        {evidence.transactions.map((transaction, index) => {
          const matchingEvent = evidence.matchingEvents.find((event) => event.txHash.toLowerCase() === transaction.hash.toLowerCase());
          return (
            <article className="transaction-proof" key={transaction.hash}>
              <div className="transaction-proof-heading">
                <span className={`tx-status ${transaction.status}`}><i /> TX {String(index + 1).padStart(2, "0")} · {transaction.status.toUpperCase()}</span>
                <div className="transaction-actions">
                  <CopyEvidence value={transaction.hash} label={`transaction ${index + 1} hash`} />
                  <a href={`https://explorer.testnet.arc.io/tx/${transaction.hash}`} target="_blank" rel="noreferrer">VIEW ORIGINAL TESTNET TRANSACTION ↗</a>
                </div>
              </div>
              <div className="transaction-hash-full"><code>{transaction.hash}</code></div>
              <div className="transaction-proof-context">
                <div><span>ECONOMIC INTENT</span><code>{evidence.intent.intentId}</code></div>
                <div><span>SETTLEMENT CONTRACT</span><code>{evidence.contract}</code></div>
                <div><span>EVENT EVIDENCE</span><strong>{matchingEvent ? `IntentSettled · ${matchingEvent.amountUsdc6} USDC6` : "No matching settlement event"}</strong></div>
              </div>
              <div className="transaction-proof-meta">
                <div><span>BLOCK</span><strong>{transaction.blockNumber}</strong></div>
                <div><span>GAS USED</span><strong>{BigInt(transaction.gasUsed).toLocaleString("en-US")}</strong></div>
                <div><span>EFFECTIVE PRICE</span><strong>{formatGwei(transaction.effectiveGasPrice)}</strong></div>
                <div><span>GAS COST · NATIVE18</span><strong>{transaction.gasCostNative18}</strong></div>
                <div><span>NORMALIZED · USDC6</span><strong>{formatUsdc6(transaction.gasCostUsdc6)} USDC</strong></div>
              </div>
            </article>
          );
        })}
        <p className="transaction-footnote">Gas cost is calculated in native USDC18, then truncated to USDC6 for display. Raw values are retained in the accepted run record.</p>
      </div>
      <p className="proof-source-note">Evidence source: accepted Sazume Arc Testnet run record · chain ID {evidence.chainId}. No browser RPC request was made.</p>
    </section>
  );
}
