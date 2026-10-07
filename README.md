# Sazume — economic reliability testing

> **Your transaction succeeded. Did the money?**
>
> Sazume tests whether programmable-money applications preserve their intended economic outcome under retries, timeouts, and duplicate execution.

Sazume tests programmable-money applications against their intended economic outcomes, not just successful transaction receipts. Its core model passed the offchain falsification spike and the Solidity/Arc Testnet qualification. Arc Mainnet has **not** been deployed or tested, and no Mainnet payment has occurred.

## Product interface

The React + TypeScript interface lives in [`apps/web`](apps/web). It starts in a configuration state, then progressively replays one selected experiment through execution, economic reconciliation, verdict, and proof inspection. The default experiment is **Unsafe / Timeout After Settlement**: both blockchain receipts succeed, then the economic invariant fails. Switching to **Idempotent** replays the corresponding preserved outcome.

This is a **verified evidence replay**, not a live execution. The browser does not call an RPC or broadcast transactions. Evidence records are validated and loaded through the presentation provider; the UI derives the trace, invariant display, transaction links, and verdict from those records. Receipt status, matching settlement events, recipient balance movement, and invariant verdict remain distinct so successful transactions can visibly coexist with an economic failure. The qualification matrix is available below the experiment after it completes.

The interface uses a monochrome conformance-folio design. Configure, execution, reconciliation, verdict, and proof are revealed in sequence; the initial view contains no completed outcome or transaction details. Captured desktop, mobile, and replay-state QA images are in [`.impeccable/review`](.impeccable/review), and the implemented visual system is recorded in [`DESIGN.md`](DESIGN.md).

Developer documentation is served by the same website at [`/docs`](https://sazume.vercel.app/docs), including installation, concepts, CLI, integration, Arc evidence, and reference pages. The product/package surface is still an unpublished release candidate; public npm install instructions are intentionally not provided.

The demonstrated qualification amount is **0.010000 USDC** (`10,000` USDC6). The CLI narrative uses a conceptual **1 USDC** obligation; it is not the amount used in the Testnet qualification. The replay's transaction and contract links are drawn from the public records in [`evidence/testnet`](evidence/testnet/).

Verified Arc Testnet fixtures:

| Fixture | Address |
| --- | --- |
| UnsafeSettlement | `0x8cd2da9e45d18c47a803f065a3625ae68bf37b17` |
| IdempotentSettlement | `0x0908e0409d593409d251306302fdca0c45198b9c` |
| USDC | `0x3600000000000000000000000000000000000000` |

These are Testnet addresses only. Mainnet deployment remains pending.

## Run it

```bash
npm install
npm test
npm run typecheck
npm run dev
npm run build
npm run demo
npm run test:contracts
npm run demo:arc-local
npm run test:contracts:arc
npm run demo:arc-foundry-local
```

## Developer CLI quickstart

Sazume's local CLI runs the same `EconomicIntent`, four canonical scenarios, runner, and invariant implementations used by the existing demos. It needs no RPC, wallet, private key, or network access:

```bash
npm install
npm run sazume -- test --adapter unsafe
npm run sazume -- test --adapter idempotent
npm run sazume -- test --adapter unsafe --scenario timeout-after-settlement
npm run --silent sazume -- test --adapter idempotent --json
```

The unsafe full matrix exits non-zero because observed settlement and fulfillment state violates invariants. The idempotent matrix exits zero. `--json` emits machine-readable results with bigint values encoded as decimal strings, and preserves the same exit status for CI. `--trace` includes deterministic scenario events. Scenario IDs are `normal`, `timeout-before-settlement`, `timeout-after-settlement`, and `duplicate-callback`.

To connect an application, implement the chain-independent [`EconomicAdapter`](packages/core/src/adapter.ts), define an intent with `defineIntent` and reusable invariants, then export a `sazume.config.mjs` containing `{ intent, adapter, scenarios }`. The complete small example is [`examples/paid-report`](examples/paid-report): its `PaidReportAdapter` stands in for the application's payment/fulfillment calls and reports observed state. Run it with:

```bash
npm run sazume -- test --config examples/paid-report/sazume.config.mjs
```

Replace that example adapter with your own application integration. The runner resets it before each scenario, observes the outcome, and evaluates the intent's invariants; the CLI only selects the configuration, presents the core results, and maps the overall verdict to an exit code. `--scenario <id>` can select one canonical failure scenario for a configured adapter. Configuration files are trusted executable JavaScript. They must use `.mjs`, `.js`, or `.cjs`; compile TypeScript configs before loading. `--init` is intentionally not provided in v0.1; the example config is the scaffold.

The package release candidates are `@sazume/core` and `@sazume/cli` (`0.1.0-rc.1`), but they are private and unpublished. Validate the public boundary locally with `npm run test:external-consumer`; this builds and installs the actual package tarballs in an isolated consumer project. The publication names and license still require owner approval.

`npm run dev` starts the static evidence replay UI at the Vite local URL. `npm run build` creates the deployable static bundle in `dist/`. The frontend uses the same recorded Sazume results and evidence; it does not reimplement the economic invariants in React.

`test:contracts` uses local Foundry with a mock ERC-20. `demo:arc-local` deploys the Solidity fixtures to ordinary Anvil (chain ID 31337) and runs the shared scenarios through the receipt/log observer. This is local EVM execution, **not Arc Foundry, an Arc fork, or evidence of Arc network execution**. See [Arc assumptions](docs/arc-assumptions.md).

`test:contracts:arc` runs the Solidity suite using Circle's official `arc-forge`. `demo:arc-foundry-local` starts `arc-anvil` with the Arc testnet chain ID and a 20 Gwei local base fee, then runs the same Solidity-backed adapter/scenarios. This remains a local Arc Foundry simulation, **not Arc Testnet execution**. For this qualification, Arc Foundry v0.8.0-2 was downloaded from Circle's release page, verified against its published SHA-256, and installed outside the repository; set `PATH` to that installation's binary directory before running these commands.

The validated offchain matrix is:

| Adapter | normal | timeout-before-settlement | timeout-after-settlement | duplicate-callback |
| --- | --- | --- | --- | --- |
| Unsafe | PASS | PASS | FAIL | FAIL |
| Fixed | PASS | PASS | PASS | PASS |

The Solidity-backed run produced the same matrix against deployed contracts on ordinary Anvil local EVM (chain ID 31337):

| Adapter | normal | timeout-before-settlement | timeout-after-settlement | duplicate-callback |
| --- | --- | --- | --- | --- |
| Unsafe onchain fixture | PASS | PASS | FAIL | FAIL |
| Fixed onchain fixture | PASS | PASS | PASS | PASS |

The Solidity-backed local run is expected to produce the same matrix because settlement counts and amounts come from successful fixture events while fulfillment remains application state. The fixed contract reverts on a duplicate intent; the reverted attempt is not counted as a settlement.

Arc Foundry v0.8.0-2 passed all four contract tests and reproduced the same 2/4 unsafe, 4/4 fixed matrix on `arc-anvil`. This is local simulation; live network qualification is recorded separately below.

### Arc Testnet qualification

The live Arc Testnet run verified RPC chain ID `5042002` before every deployment, approval, and settlement. The runner rejects mainnet. It used `0.01 USDC` (`10_000` USDC6) per obligation; the 1 USDC amount above remains the demo narrative amount. The same four scenarios produced this matrix:

| Adapter | normal | timeout-before-settlement | timeout-after-settlement | duplicate-callback |
| --- | --- | --- | --- | --- |
| Unsafe on Arc Testnet | PASS | PASS | FAIL | FAIL |
| Fixed on Arc Testnet | PASS | PASS | PASS | PASS |

The timeout-after hero runs corroborated receipts, matching `IntentSettled` events, and recipient ERC-20 USDC6 balance deltas: Unsafe had 2 successful receipts/events and a 20,000 USDC6 delta; Fixed had 1 successful receipt/event, 1 reverted duplicate, and a 10,000 USDC6 delta. Public run records and transaction receipts are under [`evidence/testnet`](evidence/testnet/). Initial harness attempts exposed two setup errors: reusing a hero intent during a full run and exhausting the unsafe fixture's allowance. Their transaction records are retained in `invalid-*` folders and excluded from the acceptance matrix. The final ten accepted scenario runs use distinct IDs and corroborate successfully.

The explicit live commands are `npm run qualify:arc-testnet:hero` (deploys fixtures and runs the hero gate) and `npm run qualify:arc-testnet:full` (runs the full matrix after the hero gate). They require a disposable wallet key in the local `PRIVATE_KEY` environment variable and submit Arc Testnet transactions. The RPC chain ID is checked before every write. Never use a mainnet key; mainnet is disabled in this qualification code.

Amounts are integer six-decimal USDC units (`1 USDC = 1_000_000`). Scenario failure injection is deterministic and uses no external network, timing, or randomness; the local adapter demos execute against local RPC nodes.

The experiment checks settlement uniqueness, exact amount for completed intents, fulfillment uniqueness, and completion consistency. The Arc adapter provisions a fresh fixture for each scenario through its reset hook; live chain state is never described as resettable. It reports receipt status and native18 gas cost diagnostically; gas does not affect PASS/FAIL.
