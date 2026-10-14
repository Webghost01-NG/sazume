import { formatUsdc6 } from "../lib/evidenceProvider.js";
import { mainnetQualification, type MainnetHeroRun } from "../lib/mainnetEvidence.js";

function shortHash(value: string) {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function Result({ run, label }: { run: MainnetHeroRun; label: string }) {
  return <article className="mainnet-result">
    <div className="mainnet-result-top"><span>{label}</span><strong>{run.passed ? "✓ PRESERVED" : "× VIOLATED"}</strong></div>
    <p><span>SETTLEMENTS</span><strong>{run.settlement.count}</strong></p>
    <p><span>RECIPIENT DELTA</span><strong>+{formatUsdc6(run.recipientDeltaUsdc6)} USDC</strong></p>
    <p><span>FULFILLMENTS</span><strong>{run.fulfillmentCount}</strong></p>
    <p><span>CONTRACT</span><a href={`https://explorer.arc.io/address/${run.contractAddress}`} target="_blank" rel="noreferrer" title={run.contractAddress}>{shortHash(run.contractAddress)} ↗</a></p>
    <p><span>INTENT ID</span><code title={run.intentId}>{shortHash(run.intentId)}</code></p>
    <div className="mainnet-transactions">
      {run.transactions.map((transaction, index) => <a href={transaction.explorer} target="_blank" rel="noreferrer" key={transaction.hash} title={transaction.hash}>
        <span>TX {String(index + 1).padStart(2, "0")} · {transaction.status === "success" ? "SUCCESS" : "EXPECTED REVERT"}</span>
        <code>{shortHash(transaction.hash)} ↗</code>
      </a>)}
    </div>
  </article>;
}

export function MainnetQualification() {
  const { unsafe, fixed, verification } = mainnetQualification;
  return <section className="mainnet-qualification" id="mainnet-record" aria-labelledby="mainnet-heading">
    <div className="section-label"><span>ARC MAINNET / VERIFIED QUALIFICATION</span><span>HISTORICAL EXECUTION · CHAIN ID {verification.chainId}</span></div>
    <div className="mainnet-intro"><h2 id="mainnet-heading">TWO SUCCESSFUL<br />PAYMENTS. ONE<br />OBLIGATION.</h2><p>The same timeout and retry was executed against two Solidity fixtures on Arc Mainnet. This is a record of completed transactions, separate from the interactive Testnet replay above.</p></div>
    <div className="mainnet-results"><Result run={unsafe} label="UNSAFE / NO IDEMPOTENCY" /><Result run={fixed} label="IDEMPOTENT / DUPLICATE REJECTED" /></div>
    <div className="mainnet-corroboration"><span>ECONOMIC CORROBORATION</span><strong>RECEIPTS = SETTLEMENT EVENTS = USDC TRANSFERS = RECIPIENT BALANCE MOVEMENT</strong><p>Unsafe: 2 successful settlements for one intent. Idempotent: 1 settlement and 1 reverted duplicate. The reverted attempt consumed gas but moved no settlement principal.</p></div>
    <details className="mainnet-ledger"><summary>INSPECT ALL {verification.transactions.length} MAINNET TRANSACTION RECEIPTS <span>DEPLOYMENTS · APPROVALS · SETTLEMENTS</span></summary><div>
      {verification.transactions.map((transaction) => <a key={transaction.hash} href={transaction.explorer} target="_blank" rel="noreferrer" title={transaction.hash}><span>{transaction.step}</span><span>{transaction.status.toUpperCase()} · BLOCK {transaction.block}</span><code>{shortHash(transaction.hash)} ↗</code></a>)}
    </div></details>
    <p className="mainnet-source">Source: <a href="https://github.com/Webghost01-NG/sazume/tree/main/evidence/mainnet" target="_blank" rel="noreferrer">public Mainnet evidence and independent verification ↗</a>. Qualification covers the timeout-after-settlement hero; the full four-scenario matrix was qualified on Arc Testnet.</p>
  </section>;
}
