# SAZUME

## The transaction succeeded. Did the money?

[![core version](https://img.shields.io/npm/v/%40sazume%2Fcore/next?label=%40sazume%2Fcore%40next)](https://www.npmjs.com/package/@sazume/core)
[![CLI version](https://img.shields.io/npm/v/%40sazume%2Fcli/next?label=%40sazume%2Fcli%40next)](https://www.npmjs.com/package/@sazume/cli)

Sazume tests whether programmable-money applications preserve one economic obligation under retries, timeouts, and duplicate execution. Two successful transactions can still mean one customer paid twice; Sazume evaluates the observed economic outcome, not receipt status alone.

**Economic reliability testing for programmable money.** [Open the verified replay](https://sazume.vercel.app) · [Read the docs](https://sazume.vercel.app/docs)

> The web experience replays previously verified Arc Testnet evidence. It does not broadcast transactions from the browser.

## What Sazume tests

An `EconomicIntent` declares who should pay whom, how much, and which economic rules must hold. The same runner applies deterministic scenarios to an application’s `EconomicAdapter`, observes its state, then evaluates reusable invariants.

The bundled scenarios are normal execution, timeout before settlement, timeout after settlement, and duplicate callback. The built-in invariants check settlement uniqueness, recipient amount, fulfillment uniqueness, and completion consistency.

## Quickstart

Install the public prerelease packages from the `next` dist-tag:

```bash
npm install @sazume/core@next
npm install --save-dev @sazume/cli@next
npx sazume test --adapter unsafe
```

The unsafe reference intentionally exits `1` when the economic invariants fail. Compare the idempotent implementation, which should exit `0`:

```bash
npx sazume test --adapter idempotent
```

The same CLI can load a custom application adapter from `sazume.config.mjs`:

```bash
npx sazume test --config ./sazume.config.mjs
npx sazume test --config ./sazume.config.mjs --json
```

Exit `0` means all selected invariants pass; `1` means an invariant or execution failed; `2` means invalid CLI usage. `--trace` prints deterministic events. The bundled adapters use no RPC, wallet, private key, or Mainnet credentials.

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

The Solidity fixtures were tested locally and across the full four-scenario matrix on Arc Testnet. Accepted Testnet runs corroborate receipts, `IntentSettled` events, and recipient ERC-20 USDC6 balance deltas. The 0.010000 USDC qualification amount is separate from the CLI’s conceptual 1 USDC example. Evidence is in [`evidence/testnet`](evidence/testnet); network and unit details are in [Arc assumptions](docs/arc-assumptions.md).

**Arc Mainnet hero qualified.** On chain 5042, the [unsafe fixture](https://explorer.arc.io/address/0x8cd2da9e45d18c47a803f065a3625ae68bf37b17) made two successful 0.010000 USDC settlements for one intent and failed the economic invariants. The [idempotent fixture](https://explorer.arc.io/address/0x0908e0409d593409d251306302fdca0c45198b9c) made one settlement and reverted the duplicate, preserving the intent. Mainnet receipts, settlement events, USDC transfers, and recipient balance deltas agree; inspect the [complete Mainnet evidence](evidence/mainnet) and the [original unsafe retry](https://explorer.arc.io/tx/0x9c06cc30b06b42a7fa1833d60595e472f47ddbb2be2557f6b6cd67350d9b133c). Principal transferred was 0.030000 USDC and gas cost was 0.027922680 USDC. This was a bounded **timeout-after-settlement** experiment, not a full Mainnet scenario matrix or production payment deployment. The browser still replays historical **Testnet** evidence and broadcasts no transaction.

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

`@sazume/core@0.1.0-rc.1` and `@sazume/cli@0.1.0-rc.1` are published under the `next` dist-tag with the MIT license. Install with the explicit `@next` tag during this prerelease; the npm `latest` tag remains the temporary `0.0.0-stage` placeholder. The core and CLI READMEs document the public APIs, adapter contract, scenarios, JSON output, and CI exit codes.

## Docs

The [documentation site](https://sazume.vercel.app/docs) covers the core model, CLI, adapters, Arc Testnet evidence, fixtures, and current limitations. The product is a testing framework—not a payment contract or production settlement service.
