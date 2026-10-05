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
npm run test:contracts:arc
npm run demo:arc-foundry-local
```

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
