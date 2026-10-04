# Sazume — offchain falsification spike

> **Your transaction succeeded. Did the money?**
>
> Sazume tests whether programmable-money applications preserve their intended economic outcome under retries, timeouts, and duplicate execution.

This repository is an **offchain falsification spike**, not yet the Arc mainnet implementation. It compares an intentionally unsafe in-memory paid-service adapter with an idempotent adapter using the same intent, four invariants, scenarios, runner, and reporter.

## Run it

```bash
npm install
npm test
npm run typecheck
npm run demo
```

The expected matrix is:

| Adapter | normal | timeout-before-settlement | timeout-after-settlement | duplicate-callback |
| --- | --- | --- | --- | --- |
| Unsafe | PASS | PASS | FAIL | FAIL |
| Fixed | PASS | PASS | PASS | PASS |

Amounts are integer six-decimal USDC units (`1 USDC = 1_000_000`). Failure injection is deterministic; no network, chain, timing, or random behavior is involved.

The experiment checks settlement uniqueness, exact amount for completed intents, fulfillment uniqueness, and completion consistency. The runner resets the adapter before each scenario so outcomes are isolated.
