# @sazume/core

Economic reliability primitives for programmable-money applications.

`@sazume/core` provides `EconomicIntent`, the `EconomicAdapter` boundary, reusable invariants, deterministic scenarios, the runner, and structured outcomes. The package evaluates observed application state; an adapter does not choose its own verdict.

## Install

```sh
npm install @sazume/core@next
```

## Define an economic intent

```ts
import {
  defineIntent,
  settlementUniqueness,
  recipientAmount,
  fulfillmentUniqueness,
  completionConsistency,
} from "@sazume/core";

const intent = defineIntent({
  id: "ORDER-42",
  payment: {
    payer: "customer",
    recipient: "merchant",
    asset: { symbol: "USDC", decimals: 6 },
    amount: 10_000n,
  },
  invariants: [
    settlementUniqueness(),
    recipientAmount(),
    fulfillmentUniqueness(),
    completionConsistency(),
  ],
});
```

Implement `EconomicAdapter` for the application state you need Sazume to observe, then pass it and scenarios to `sazume.run`. Amounts use integer base units (`bigint`); never use floating point for monetary values.

See the [integration guide](https://sazume.vercel.app/docs/integration) for a complete adapter example.

## License

MIT. See [LICENSE](./LICENSE).
