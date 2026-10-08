# @sazume/cli

Run Sazume's economic scenarios against an application adapter from your terminal.

## Install

```sh
npm install @sazume/core@next
npm install --save-dev @sazume/cli@next
```

The CLI depends on the matching `@sazume/core` release and exposes the executable `sazume`.

## Run a test

Create `sazume.config.mjs` that exports an intent, your adapter, and the selected scenarios:

```js
import { defineConfig } from "@sazume/cli/config";
import { normal, timeoutAfterSettlement } from "@sazume/cli/scenarios";
import { intent, adapter } from "./payment-adapter.mjs";

export default defineConfig({
  intent,
  adapter,
  scenarios: [normal(), timeoutAfterSettlement()],
});
```

Then run:

```sh
npx sazume test --config ./sazume.config.mjs
npx sazume test --config ./sazume.config.mjs --json
```

`0` means all selected economic invariants passed, `1` means an invariant failed or execution could not be trusted, and `2` indicates invalid CLI usage. JSON mode writes machine-readable output to stdout. Configuration files execute as trusted local JavaScript; only load code you control.

See the [CLI guide](https://sazume.vercel.app/docs/cli) and [adapter integration guide](https://sazume.vercel.app/docs/integration).

## License

MIT. See [LICENSE](./LICENSE).
