# `@sazume/cli`

CLI for running deterministic Sazume economic scenarios against an application adapter.

```sh
sazume test --config sazume.config.mjs
sazume test --scenario timeout-after-settlement --trace --config sazume.config.mjs
sazume test --config sazume.config.mjs --json
```

The executable consumes `@sazume/core` and its own canonical scenario implementations. Config files are executable local JavaScript; only load code you trust. This private release candidate is not published.
