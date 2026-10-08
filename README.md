# SAZUME

## The transaction succeeded. Did the money?

Sazume tests whether programmable-money applications preserve one economic obligation under retries, timeouts, and duplicate execution. Two successful transactions can still mean one customer paid twice; Sazume evaluates the observed economic outcome, not receipt status alone.

**Economic reliability testing for programmable money.** [Open the verified replay](https://sazume.vercel.app) · [Read the docs](https://sazume.vercel.app/docs)

> The web experience replays previously verified Arc Testnet evidence. It does not broadcast transactions from the browser.

## What Sazume tests

An `EconomicIntent` declares who should pay whom, how much, and which economic rules must hold. The same runner applies deterministic scenarios to an application’s `EconomicAdapter`, observes its state, then evaluates reusable invariants.

The bundled scenarios are normal execution, timeout before settlement, timeout after settlement, and duplicate callback. The built-in invariants check settlement uniqueness, recipient amount, fulfillment uniqueness, and completion consistency.

## Quickstart

The npm packages are **not published**. Use a source checkout for now:

```bash
git clone https://github.com/Webghost01-NG/sazume.git
cd sazume
npm ci
npm run sazume -- test --adapter unsafe
```

The unsafe adapter exits `1` because the observed state violates economic invariants. Compare the idempotent implementation:

```bash
npm run sazume -- test --adapter idempotent
npm run --silent sazume -- test --adapter idempotent --json
```

Exit `0` means all selected scenarios pass; `1` means an economic or execution failure; `2` means invalid CLI usage. `--trace` prints deterministic events. Ordinary tests use no RPC, wallet, private key, or Mainnet credentials.

Unsafe result:

```text
normal                       PASS
timeout-before-settlement    PASS
timeout-after-settlement     FAIL  (2 settlements for 1 intent)
duplicate-callback           FAIL  (2 fulfillments for 1 intent)
```

## Connect an application

Implement the chain-independent [`EconomicAdapter`](packages/core/src/adapter.ts), create an intent with `defineIntent`, and export `{ intent, adapter, scenarios }` from a trusted JavaScript config. See the runnable [paid-report example](examples/paid-report) and [integration guide](https://sazume.vercel.app/docs/integration). Config files execute as local code; only load files you trust.

The CLI calls the existing core runner and invariant engine. An adapter reports application behavior and observed economic state; it does not choose the verdict. The external-consumer check packs the packages and validates them in a separate temporary project:

```bash
npm run test:external-consumer
```

## Arc qualification

The Solidity fixtures were tested locally and on Arc Testnet. Accepted Testnet runs corroborate receipts, `IntentSettled` events, and recipient ERC-20 USDC6 balance deltas. The 0.010000 USDC qualification amount is separate from the CLI’s conceptual 1 USDC example. Evidence is in [`evidence/testnet`](evidence/testnet); network and unit details are in [Arc assumptions](docs/arc-assumptions.md).

**Arc Mainnet has not been deployed or qualified.** No Mainnet transaction has been sent and no Mainnet USDC has been spent. The Arc fixture adapter rejects Mainnet execution. Mainnet remains a separately approved phase.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run demo
npm run test:contracts
npm run demo:arc-local
```

The reference packages are local release candidates `@sazume/core` and `@sazume/cli` (`0.1.0-rc.1`). They are private, unpublished, and have no approved open-source license yet. npm scope ownership is not verified. Do not use `npm install @sazume/core` or `npm install @sazume/cli` until publication is announced. See [npm release readiness](docs/release-readiness.md) for package and publication gates.

## Docs

The [documentation site](https://sazume.vercel.app/docs) covers the core model, CLI, adapters, Arc Testnet evidence, fixtures, and current limitations. The product is a testing framework—not a payment contract or production settlement service.
