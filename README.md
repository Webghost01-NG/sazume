# Sazume — economic reliability testing

> **Your transaction succeeded. Did the money?**
>
> Sazume tests whether programmable-money applications preserve their intended economic outcome under retries, timeouts, and duplicate execution.

Sazume's core economic reliability model has been validated offchain. The current integration phase adds Solidity-backed settlement and Arc-aware observation before any mainnet deployment. No mainnet deployment or payment has occurred.

## Run it

```bash
npm install
npm test
npm run typecheck
npm run demo
npm run test:contracts
npm run demo:arc-local
```

`test:contracts` uses local Foundry with a mock ERC-20. `demo:arc-local` deploys the Solidity fixtures to ordinary Anvil (chain ID 31337) and runs the shared scenarios through the receipt/log observer. This is local EVM execution, **not Arc Foundry, an Arc fork, or evidence of Arc network execution**. See [Arc assumptions](docs/arc-assumptions.md).

After installing Circle's Arc Foundry, `npm run test:contracts:arc` runs the Solidity suite with `arc-forge`. Arc Foundry was not available in the execution environment for this spike, so this command is provided but was not verified here.

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

Amounts are integer six-decimal USDC units (`1 USDC = 1_000_000`). Failure injection is deterministic; no network, chain, timing, or random behavior is involved.

The experiment checks settlement uniqueness, exact amount for completed intents, fulfillment uniqueness, and completion consistency. The Arc adapter provisions a fresh fixture for each scenario through its reset hook; live chain state is never described as resettable. It reports receipt status and native18 gas cost diagnostically; gas does not affect PASS/FAIL.
