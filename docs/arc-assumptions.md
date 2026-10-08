# Arc assumptions verified for this spike

**Checked:** 2026-10-08 against current official Arc documentation and one read-only Mainnet RPC provider. Parameters can change.

## Network and tooling

| Network | Chain ID | Official RPC | Explorer |
| --- | ---: | --- | --- |
| Arc mainnet | `5042` | `https://rpc.mainnet.arc.io` | `https://explorer.arc.io` |
| Arc testnet | `5042002` | `https://rpc.testnet.arc.io` | `https://explorer.testnet.arc.io` |

On 2026-10-08, the Circle documentation still listed Mainnet chain ID `5042`, USDC contract `0x3600000000000000000000000000000000000000`, and 6 ERC-20 decimals. The canonical `rpc.mainnet.arc.io` returned HTTP 403 from this execution environment. The Arc-listed Blockdaemon endpoint returned chain ID `5042`, USDC decimals `6`, and a latest block with a `20_000_000_000` wei base fee; it is a point-in-time observation, not a fee guarantee. Mainnet values and gas assumptions are expanded in `docs/mainnet-preflight.md`.

Arc documents **Arc Foundry**, a Circle fork with `arc-forge`, `arc-cast`, and `arc-anvil`, because ordinary Foundry does not encode all Arc protocol differences. The official instructions install release binaries. Standard `forge`/`anvil` used by `npm run test:contracts` and `npm run demo:arc-local` are used only for Solidity/local EVM simulation. That demo prints its chain ID and does not claim Arc runtime equivalence.

On 2026-10-05, the latest official Circle release was `v0.8.0-2`. The x86_64 Linux archive was downloaded from the official `circlefin/arc-foundry` release, using byte ranges after the ordinary transfer reset. Its SHA-256 matched Circle's published checksum: `088bdb96a84418b757f9825d491e702792f1d1d1e29a9145af305a6600a79556`. The isolated binaries report version `1.7.1-dev`, commit `d497beea7096ff2a8e583c8b307941f24a61b06b`; standard system Foundry binaries were not replaced. `arc-forge test --root contracts -vv` passed 4/4 contract tests. Arc Anvil was also run locally with chain ID `5042002` and base fee `20_000_000_000` wei-shaped units; this is an Arc Foundry local simulator, not Arc Testnet. The full shared scenario matrix is recorded in README.

Circle's official docs direct developers to the Circle Faucet for testnet USDC. Funding was supplied to the disposable testnet wallet through the faucet. The Arc Testnet RPC returned chain ID `5042002` before each broadcast. Two fixtures were deployed to testnet, then hero and full matrix scenarios were run with unique intents. Detailed public evidence, including receipts, event counts, recipient balance deltas, and gas, is under `evidence/testnet/`. No private key or credential is stored in evidence.

## USDC and units

- The application-facing ERC-20 interface is at `0x3600000000000000000000000000000000000000` on mainnet and testnet, with **6 decimals**.
- Arc also exposes the same underlying USDC balance as its native gas asset at **18 decimals**. These are two interfaces/views of one economic asset, not separate balances. Never sum them.
- An ERC-20 USDC transfer emits a 6-decimal log from the ERC-20 contract and an 18-decimal system `Transfer` log. Arc warns indexers to distinguish emitters to avoid counting one movement twice.
- `native18ToUsdc6` divides by `10^12` using integer arithmetic and truncates any remainder below one USDC6 unit. It never rounds up. Settlement intents/contracts continue to use USDC6 unchanged.
- Arc denominates gas in USDC native18 units. Receipt gas cost is `gasUsed * effectiveGasPrice`; this remains diagnostic and is not an invariant input.
- Arc gas docs document a 20 Gwei minimum base fee for Testnet, a 20,000 Gwei maximum base fee, and an EIP-1559 + EWMA fee market. Do not treat the Testnet minimum as a verified Mainnet minimum. The testnet adapter applies the 20 Gwei `maxFeePerGas` floor only when configured with chain ID `5042002`.

## Finality and receipts

Arc documents a two-state transaction lifecycle: unconfirmed or final, with committed blocks irreversibly finalized in under one second. Testnet transactions were submitted, included, and returned successful or reverted receipts; the adapter treated receipt availability on inclusion as final and added no Ethereum-style confirmation count. Each qualification scenario additionally checked matching `IntentSettled` events and the recipient's ERC-20 USDC6 balance delta. All accepted testnet scenarios had receipt/event/balance agreement. Reverted receipts contributed transaction/gas diagnostics but no settlement event. Arc documents a blocklist-revert path that can consume gas without returning a normal receipt; this integration does not yet classify that RPC behavior and it remains a live-observation limitation.

The fixture observer's in-application outcome is derived from successful fixture events and receipts; testnet qualification wraps it with an explicit before/after recipient USDC6 balance corroboration. Gas remains diagnostic. Receipt `gasUsed × effectiveGasPrice` was observed at a 25 Gwei effective price in these runs. `native18ToUsdc6` divides the resulting native18 cost by `10^12`, truncating sub-USDC6 precision while retaining the raw native18 amount in evidence.

## Sources

- [Arc documentation index](https://docs.arc.io/llms.txt)
- [Connect to Arc: chain IDs and RPC URLs](https://docs.arc.io/arc/references/connect-to-arc.md)
- [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses.md)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences.md)
- [USDC system events](https://docs.arc.io/arc/references/usdc-system-events.md)
- [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees.md)
- [Deterministic finality](https://docs.arc.io/arc/concepts/deterministic-finality.md)
- [Install Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry.md)
- [Circle's official Arc Foundry releases](https://github.com/circlefin/arc-foundry/releases)
- [Circle Faucet](https://faucet.circle.com/)
- [Mainnet preflight estimates and limits](mainnet-preflight.md)
