import { useMemo, useState, type ReactElement } from "react";

const pages = [
  { path: "/docs", group: "START HERE", title: "Introduction", description: "Why a successful transaction can still produce a failed payment." },
  { path: "/docs/getting-started", group: "START HERE", title: "Installation & quickstart", description: "Run your first economic test locally." },
  { path: "/docs/concepts", group: "CONCEPTS", title: "Core model", description: "Intent, adapter, outcome, invariants, and deterministic scenarios." },
  { path: "/docs/cli", group: "CLI", title: "Command line", description: "Options, configuration, trace, JSON, and process status." },
  { path: "/docs/integration", group: "INTEGRATION", title: "Connect an application", description: "Implement the adapter boundary and use it in CI." },
  { path: "/docs/arc", group: "ARC", title: "Arc qualification", description: "What was verified on Testnet and what remains unqualified." },
  { path: "/docs/reference", group: "REFERENCE", title: "Fixtures & trust model", description: "Reference applications, evidence limits, and known constraints." },
];

function Code({ children }: { children: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");

  async function copyCode() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(children);
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  return <pre className="docs-code"><code>{children}</code><button type="button" onClick={() => void copyCode()} aria-label={copyState === "copied" ? "Code copied to clipboard" : copyState === "unavailable" ? "Clipboard unavailable; select the code manually" : "Copy code"}>{copyState === "copied" ? "COPIED" : copyState === "unavailable" ? "SELECT CODE" : "COPY"}</button><span className="sr-only" role="status" aria-live="polite">{copyState === "copied" ? "Code copied to clipboard." : copyState === "unavailable" ? "Clipboard unavailable. Select the code manually." : ""}</span></pre>;
}

function Introduction() {
  return <>
    <p className="docs-lede">A transaction receipt records execution. It does not prove that an application preserved the customer's economic intent.</p>
    <p>One obligation can be paid twice when a successful response is lost and the application retries. Both transactions may succeed onchain while the customer loses twice the intended amount. Sazume runs deterministic failure scenarios against an application adapter, observes the resulting economic state, and evaluates reusable invariants.</p>
    <h2>The experiment</h2>
    <Code>{`EconomicIntent → Scenario → ApplicationAdapter
      → EconomicOutcome → Invariants → PASS / FAIL`}</Code>
    <p>The reference CLI and web replay use the same chain-independent core. The web experience replays accepted Arc Testnet records; it does not send transactions. Mainnet has not been deployed or qualified.</p>
    <p className="docs-next"><a href="/docs/getting-started">Install and run the first test →</a></p>
  </>;
}

function GettingStarted() {
  return <>
    <p className="docs-lede">The release candidates are not published to npm yet. In a Sazume source checkout, install dependencies and build the local packages first. No RPC, wallet, or key is used.</p>
    <Code>{`npm ci
npm pack --workspace=@sazume/core
npm pack --workspace=@sazume/cli`}</Code>
    <p>Those commands create the two versioned tarballs in the checkout. Install both tarballs into a consumer project with <code>npm install /path/to/sazume-core-0.1.0-rc.1.tgz /path/to/sazume-cli-0.1.0-rc.1.tgz</code>. The npm scope and licensing still need publication approval.</p>
    <Code>{`npm run sazume -- test --adapter unsafe
npm run sazume -- test --adapter idempotent`}</Code>
    <h2>Read the result</h2>
    <p>The unsafe adapter exits non-zero because the observed outcome violates settlement and fulfillment uniqueness in two scenarios. The idempotent adapter exits zero because the same scenarios leave the obligation settled and fulfilled once.</p>
    <Code>{`UNSAFE:    PASS, PASS, FAIL, FAIL
IDEMPOTENT: PASS, PASS, PASS, PASS`}</Code>
    <p>Use a single canonical scenario while developing an adapter:</p>
    <Code>{`npm run sazume -- test --adapter unsafe \\
  --scenario timeout-after-settlement --trace`}</Code>
  </>;
}

function Concepts() {
  return <>
    <p className="docs-lede">The core models an economic obligation separately from the application and execution system that tries to fulfill it.</p>
    <h2>EconomicIntent</h2><p>A stable human ID, deterministic machine ID, payer, recipient, asset precision, integer amount, and invariant list. Retries reuse the same intent ID. Amounts are bigint in USDC6 units in the reference experiment.</p>
    <h2>EconomicAdapter</h2><p>The application boundary: <code>settle</code>, <code>fulfill</code>, <code>markComplete</code>, <code>observe</code>, and <code>reset</code>. Scenarios know only this interface.</p>
    <h2>EconomicOutcome & invariants</h2><p>An adapter's observation reports settlement count and value, fulfillment count, and completion. The four reusable checks are settlement uniqueness, recipient amount, fulfillment uniqueness, and completion consistency.</p>
    <h2>Failure scenarios</h2><p><code>normal</code>, <code>timeout-before-settlement</code>, <code>timeout-after-settlement</code>, and <code>duplicate-callback</code> deterministically control the order of calls. They do not branch on adapter identity or use random timing.</p>
  </>;
}

function Cli() {
  return <>
    <p className="docs-lede">The CLI loads an application configuration, calls the existing runner, and maps the derived result to readable or machine output.</p>
    <Code>{`sazume test --config ./sazume.config.mjs
sazume test --scenario timeout-after-settlement --trace
sazume test --config ./sazume.config.mjs --json`}</Code>
    <h2>Configuration</h2><p>JavaScript config files are executable trusted local code. Export <code>{`{ intent, adapter, scenarios }`}</code> as the default export or named <code>config</code>. TypeScript config must be compiled to JavaScript before loading; the CLI does not install a runtime transpiler.</p>
    <h2>Trace and JSON</h2><p><code>--trace</code> prints deterministic trace entries. <code>--json</code> writes only versioned JSON to stdout; bigint values are decimal strings. Errors also produce a JSON error object when JSON mode is requested.</p>
    <h2>Exit codes</h2><p><code>0</code> means every selected scenario passed. <code>1</code> means an invariant failed or execution could not be trusted. <code>2</code> means invalid CLI usage or an unsupported option.</p>
  </>;
}

function Integration() {
  return <>
    <p className="docs-lede">Your adapter reports what your application actually did. Sazume owns the scenarios, runner, and invariant evaluation.</p>
    <p>The runnable reference lives at <code>examples/paid-report</code>. It imports <code>@sazume/core</code> and <code>@sazume/cli</code> through package exports and implements its own application state. It is exercised by <code>npm run test:external-consumer</code> in a separate temporary consumer project.</p>
    <Code>{`import { defineIntent, settlementUniqueness,
  recipientAmount, fulfillmentUniqueness,
  completionConsistency } from "@sazume/core";
import { defineConfig } from "@sazume/cli/config";
import { normal, timeoutBeforeSettlement,
  timeoutAfterSettlement, duplicateCallback }
  from "@sazume/cli/scenarios";
import { PaidReportAdapter } from "./adapter.mjs";

export default defineConfig({
  intent: defineIntent({
    id: "REPORT-42",
    payment: { payer: "buyer", recipient: "publisher",
      asset: { symbol: "USDC", decimals: 6 }, amount: 250_000n },
    invariants: [settlementUniqueness(), recipientAmount(),
      fulfillmentUniqueness(), completionConsistency()],
  }),
  adapter: new PaidReportAdapter(),
  scenarios: [normal(), timeoutBeforeSettlement(),
    timeoutAfterSettlement(), duplicateCallback()],
});`}</Code>
    <h2>Continuous integration</h2><p>The repository's <code>.github/workflows/sazume-ci-example.yml</code> verifies both exit paths and archives JSON without wallet credentials. Replace the reference configuration with your trusted application adapter. Ordinary tests have no Mainnet capability.</p>
  </>;
}

function Arc() {
  return <>
    <p className="docs-lede">The Arc adapter was qualified against Arc Testnet. This is not a Mainnet deployment or guarantee.</p>
    <h2>Verified Testnet evidence</h2><p>The accepted hero records corroborate successful transaction receipts, matching settlement events, and recipient ERC-20 balance deltas. Unsafe recorded two successful 0.010000 USDC settlements; the idempotent fixture recorded one successful settlement and a reverted duplicate. Original hashes and gas data are available in the homepage proof inspector and <code>evidence/testnet</code>.</p>
    <h2>USDC units</h2><p>Application settlement is measured through ERC-20 USDC with six decimals. Arc also exposes native USDC at 18 decimal precision for gas. Those are precision views of the same economic asset; balances must not be added. Gas keeps its native18 raw value and is converted to USDC6 by integer division by 10<sup>12</sup>, truncating sub-USDC6 remainder for display.</p>
    <h2>Replay and network status</h2><p>The homepage action runs a verified evidence replay only. It does not create transactions from the browser. Explorer links identify original Testnet transactions. Arc Mainnet remains not deployed and not tested by Sazume.</p>
  </>;
}

function Reference() {
  return <>
    <p className="docs-lede">The bundled adapters are fixtures that make the failure visible; they are not production payment integrations.</p>
    <h2>Unsafe settlement</h2><p>The fixture accepts repeated settlement calls for an intent. On the offchain model, observed state naturally reaches two settlements after a lost acknowledgement and retry.</p>
    <h2>Idempotent settlement</h2><p>The fixture prevents a second economic transfer for an already settled intent. The Arc Solidity fixture reverts the duplicate call; reverted execution consumes gas onchain but is not counted as a settlement.</p>
    <h2>Trust model</h2><p>Sazume can only evaluate the state its adapter can observe. On Arc qualification, the observer corroborates receipt status, matching events, and recipient ERC-20 balance delta; disagreement is surfaced as an observer inconsistency.</p>
    <h2>Known limitations</h2><p>The package names are reserved as private release candidates and have not been published. Adapter quality and completeness remain the integrator's responsibility. The current scenario set is deliberately small and deterministic. No Mainnet evidence exists.</p>
  </>;
}

const renderers: Record<string, () => ReactElement> = {
  "/docs": Introduction,
  "/docs/getting-started": GettingStarted,
  "/docs/concepts": Concepts,
  "/docs/cli": Cli,
  "/docs/integration": Integration,
  "/docs/arc": Arc,
  "/docs/reference": Reference,
};

export default function Docs() {
  const path = useMemo(() => window.location.pathname.replace(/\/$/, "") || "/docs", []);
  const current = pages.find((page) => page.path === path) ?? pages[0]!;
  const Content = renderers[current.path]!;
  return <div className="docs-shell">
    <header className="docs-masthead"><a href="/" className="docs-brand">SAZUME <span>DOCUMENTATION</span></a><a href="/">BACK TO EXPERIMENT ↗</a></header>
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="Documentation">
        <p>GUIDES & REFERENCE</p>
        {pages.map((page) => <a key={page.path} href={page.path} aria-current={current.path === page.path ? "page" : undefined}><span>{page.group}</span>{page.title}</a>)}
        <p className="docs-status">ARC TESTNET<br />VERIFIED EVIDENCE<br /><br />MAINNET<br />NOT DEPLOYED</p>
      </nav>
      <article className="docs-article">
        <div className="docs-breadcrumb"><a href="/docs">DOCS</a><span>/</span>{current.group}</div>
        <h1>{current.title}</h1><p className="docs-description">{current.description}</p>
        <div className="docs-rule" />
        <Content />
        <footer className="docs-article-footer"><span>ECONOMIC RELIABILITY TESTING</span><a href="/">RETURN TO SAZUME →</a></footer>
      </article>
    </div>
  </div>;
}
