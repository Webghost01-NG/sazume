# @sazume/cli

Run deterministic economic-reliability scenarios against your application from a terminal. The CLI uses Sazume’s shared runner and invariant engine: your adapter supplies operations and observed state; Sazume derives the verdict from that state.

## Install

Requires Node.js 20.19 or later.

```sh
npm install @sazume/core@next
npm install --save-dev @sazume/cli@next
```

The CLI depends on the matching exact version of `@sazume/core`. Installing the CLI installs that dependency as well; installing both explicitly makes the core API available to your application code. The executable is `sazume`.

## Run the bundled reference adapters

The bundled adapters let you see the four canonical scenarios and their economic verdicts without an RPC, wallet, private key, or external service:

```sh
npx sazume test --adapter unsafe
npx sazume test --adapter idempotent
```

The unsafe adapter produces two settlements after a timeout-after-settlement retry and two fulfillments after a duplicate callback. Its full matrix is expected to have two passing and two failing scenarios. The idempotent adapter suppresses duplicate economic effects and passes all four. These outcomes are derived by the same core invariants used for custom adapters.

Run one scenario at a time:

```sh
npx sazume test --adapter unsafe --scenario timeout-after-settlement
npx sazume test --adapter idempotent --scenario duplicate-callback
```

Supported IDs are `normal`, `timeout-before-settlement`, `timeout-after-settlement`, and `duplicate-callback`.

## Connect an application

Create `sazume.config.mjs` in your project. A config exports an economic intent, an adapter that implements the public `EconomicAdapter` interface, and the scenarios to run. This compact example models an idempotent paid-report service; replace its in-memory operations with your application’s payment and fulfillment calls.

```js
import {
  completionConsistency,
  defineIntent,
  fulfillmentUniqueness,
  recipientAmount,
  settlementUniqueness,
} from "@sazume/core";
import { defineConfig } from "@sazume/cli/config";
import {
  duplicateCallback,
  normal,
  timeoutAfterSettlement,
  timeoutBeforeSettlement,
} from "@sazume/cli/scenarios";

class PaidReportAdapter {
  settlements = new Map();
  fulfillments = new Set();
  completed = new Set();

  async settle(intent) {
    const previous = this.settlements.get(intent.intentId);
    if (previous) return { accepted: false, amount: previous.amount };
    this.settlements.set(intent.intentId, {
      count: 1,
      amount: intent.payment.amount,
    });
    return { accepted: true, amount: intent.payment.amount };
  }

  async fulfill(intent) {
    if (this.fulfillments.has(intent.intentId)) return { accepted: false };
    this.fulfillments.add(intent.intentId);
    return { accepted: true };
  }

  async markComplete(intent) {
    this.completed.add(intent.intentId);
  }

  async observe(intent) {
    const settlement = this.settlements.get(intent.intentId);
    return {
      intentId: intent.intentId,
      settlement: {
        count: settlement?.count ?? 0,
        totalAmount: settlement?.amount ?? 0n,
      },
      fulfillment: { count: Number(this.fulfillments.has(intent.intentId)) },
      completed: this.completed.has(intent.intentId),
    };
  }

  async reset() {
    this.settlements.clear();
    this.fulfillments.clear();
    this.completed.clear();
  }
}

const intent = defineIntent({
  id: "REPORT-42",
  payment: {
    payer: "customer-42",
    recipient: "report-service",
    asset: { symbol: "USDC", decimals: 6 },
    amount: 10_000n, // 0.010000 USDC in USDC6 units
  },
  invariants: [
    settlementUniqueness(),
    recipientAmount(),
    fulfillmentUniqueness(),
    completionConsistency(),
  ],
});

export default defineConfig({
  intent,
  adapter: new PaidReportAdapter(),
  scenarios: [
    normal(),
    timeoutBeforeSettlement(),
    timeoutAfterSettlement(),
    duplicateCallback(),
  ],
});
```

Run the configured matrix:

```sh
npx sazume test
```

Choose a config path and/or select one scenario:

```sh
npx sazume test --config ./sazume.config.mjs --scenario timeout-after-settlement
```

### Adapter contract

The adapter implements these asynchronous methods:

| Method | Responsibility |
| --- | --- |
| `settle(intent)` | Attempt settlement; return `{ accepted, amount }`. |
| `fulfill(intent)` | Attempt application fulfillment; return `{ accepted }`. |
| `markComplete(intent)` | Record the workflow’s completion claim. |
| `observe(intent)` | Return observed `intentId`, settlement count and total `bigint` amount, fulfillment count, and completion state. |
| `reset()` | Restore isolated scenario state before the next scenario. |

Retries inside a scenario receive the same `EconomicIntent` and deterministic `intentId`. Each scenario starts with `reset()`. The observer must describe actual application or execution state rather than infer success from attempted calls. For chain adapters, reconcile observed effects with trustworthy execution evidence before returning an outcome.

## Scenarios and invariants

The canonical scenarios are:

- `normal`: settle, fulfill, complete.
- `timeout-before-settlement`: record a timeout before settlement, retry the same intent, then settle and fulfill.
- `timeout-after-settlement`: settle, lose the acknowledgement, retry the same intent, then fulfill.
- `duplicate-callback`: settle once and process the fulfillment callback twice.

The built-in invariants evaluate the observed outcome:

- **Settlement uniqueness:** one intent has at most one settlement.
- **Recipient amount:** a completed intent delivered exactly its intended integer USDC6 amount.
- **Fulfillment uniqueness:** one intent has at most one fulfillment.
- **Completion consistency:** a workflow marked complete has both settlement and fulfillment.

The runner evaluates every invariant attached to the intent after each scenario. Overall PASS means every selected scenario passed every attached invariant. The CLI does not encode a verdict by adapter name.

## Trace output

Print deterministic operation events alongside the human-readable report:

```sh
npx sazume test --adapter unsafe --scenario timeout-after-settlement --trace
```

Trace events include settlement attempts and observations, timeout, retry, fulfillment operations, and callbacks. The bundled CLI adapters are in-memory references; custom adapter traces do not claim chain metadata such as transaction hashes or blocks.

## JSON output and CI

Use `--json` for a versioned machine-readable report on stdout:

```sh
npx sazume test --adapter unsafe --json > sazume-report.json
```

Bigint amounts are serialized as decimal strings. The report includes `schemaVersion`, CLI version, adapter name, intent, per-scenario outcomes, invariant results, traces, verdict, and pass/fail summary. On JSON errors, stdout contains a JSON error object; no terminal decoration is written there.

Exit codes:

| Code | Meaning |
| ---: | --- |
| `0` | All selected economic invariants passed. |
| `1` | An invariant failed, config could not load/validate, or adapter execution failed. |
| `2` | CLI usage is invalid, such as an unknown option, adapter, or scenario. |

For example, CI fails when the unsafe reference implementation violates an economic invariant:

```yaml
- run: npm ci
- run: npx sazume test --adapter idempotent --json
```

Change `idempotent` to `unsafe` to see the command return nonzero on the two economically unsafe scenarios. Ordinary CLI tests do not need credentials or send transactions; the bundled adapters are local in-memory examples.

## Configuration security

Config files are executable local JavaScript (`.mjs`, `.js`, or `.cjs`), loaded by Node in the current process. They can access the same filesystem, environment variables, and network permissions as any code you run. Only load configuration from your own project or another source you trust. TypeScript config files must be compiled to JavaScript first.

The CLI can run the bundled in-memory adapters or a custom configured adapter. It does not silently connect a wallet or broadcast a transaction. Your adapter determines what external systems it calls; treat any adapter with signing or network access as application code that requires its own safeguards.

## Further reading

- [Sazume documentation](https://sazume.vercel.app/docs)
- [Getting started](https://sazume.vercel.app/docs/getting-started)
- [CLI guide](https://sazume.vercel.app/docs/cli)
- [Custom adapter integration](https://sazume.vercel.app/docs/integration)
- [Arc assumptions and Testnet evidence](https://github.com/Webghost01-NG/sazume/tree/main/docs)
- [Repository and issues](https://github.com/Webghost01-NG/sazume)

Sazume has been qualified against verified Arc Testnet execution evidence. This package does not claim Arc Mainnet deployment or qualification. The website’s Arc Testnet demonstration replays previously captured evidence and does not broadcast transactions from the browser.

## License

MIT. See [LICENSE](./LICENSE).
