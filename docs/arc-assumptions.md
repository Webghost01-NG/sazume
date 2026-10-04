# Arc assumptions verified for this spike

**Checked:** 2026-10-05 against current official Arc documentation. Parameters can change.

## Network and tooling

| Network | Chain ID | Official RPC | Explorer |
| --- | ---: | --- | --- |
| Arc mainnet | `5042` | `https://rpc.mainnet.arc.io` | `https://explorer.arc.io` |
| Arc testnet | `5042002` | `https://rpc.testnet.arc.io` | `https://explorer.testnet.arc.io` |

Arc documents **Arc Foundry**, a Circle fork with `arc-forge`, `arc-cast`, and `arc-anvil`, because ordinary Foundry does not encode all Arc protocol differences. The official instructions install release binaries. Standard `forge`/`anvil` used by `npm run test:contracts` and `npm run demo:arc-local` are used only for Solidity/local EVM simulation. That demo prints its chain ID and does not claim Arc runtime equivalence.

## USDC and units

- The application-facing ERC-20 interface is at `0x3600000000000000000000000000000000000000` on mainnet and testnet, with **6 decimals**.
- Arc also exposes the same underlying USDC balance as its native gas asset at **18 decimals**. These are two interfaces/views of one economic asset, not separate balances. Never sum them.
- An ERC-20 USDC transfer emits a 6-decimal log from the ERC-20 contract and an 18-decimal system `Transfer` log. Arc warns indexers to distinguish emitters to avoid counting one movement twice.
- `native18ToUsdc6` divides by `10^12` using integer arithmetic and truncates any remainder below one USDC6 unit. It never rounds up. Settlement intents/contracts continue to use USDC6 unchanged.
- Arc denominates gas in USDC native18 units. Receipt gas cost is `gasUsed * effectiveGasPrice`; this remains diagnostic and is not an invariant input.
- Arc Testnet gas docs state a 20 Gwei minimum base fee / `maxFeePerGas` floor (testnet parameters may change). The adapter applies a minimum max-fee only when configured with testnet chain ID `5042002`.

## Finality and receipts

Arc documents a two-state transaction lifecycle: unconfirmed or final, with committed blocks irreversibly finalized in under one second. The adapter waits for a transaction receipt and does not add an Ethereum-style confirmation count. A successful receipt alone is not treated as proof of settlement: outcome count and amount come from successful `IntentSettled` logs emitted by the configured fixture. Reverted receipts contribute transaction/gas diagnostics but no settlement event. Arc documents a blocklist-revert path that can consume gas without returning a normal receipt; this integration does not yet classify that RPC behavior and it remains a live-observation limitation.

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
