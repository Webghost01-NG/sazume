# Arc Mainnet preflight — no broadcast authorized

**Status: MAINNET PREFLIGHT READY FOR REVIEW — BROADCAST NOT AUTHORIZED.** Checked 2026-10-08. The Arc runtime package still rejects chain ID 5042; no Mainnet deployment or signing path was added.

## Verified network data

Current Circle docs list Arc Mainnet chain ID `5042`, canonical RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`, and USDC contract `0x3600000000000000000000000000000000000000`. The ERC-20 `decimals()` call returns 6. The same underlying USDC is exposed as native 18-decimal gas balance; never add native and ERC-20 views. Arc docs describe EIP-1559 with EWMA fee smoothing, a current documented 20,000 Gwei maximum base fee, and sub-second deterministic finality. The 20 Gwei minimum is explicitly described for Testnet, not assumed as a Mainnet floor.

Read-only request to the canonical Mainnet RPC returned HTTP 403 from this environment. A second endpoint listed by Arc docs, `https://rpc.blockdaemon.mainnet.arc.io`, returned chain ID `5042`, latest block `24812537`, base fee `20,000,000,000` wei, `eth_gasPrice` `20,000,000,001` wei, USDC decimals 6, and deployed bytecode at the listed USDC address. Latest block sample was observed at `2026-10-08 00:02:56 UTC`; it is a point-in-time observation, not a fee guarantee. No private key or funded signer is configured for Mainnet.

## Minimum qualification plan

Use two fixture contracts and one unique intent per implementation, each for `0.010000 USDC` (`10,000` USDC6). The amount is a recommendation based on the accepted Testnet experiment, not a Mainnet execution.

1. Deploy `UnsafeSettlement(mainnet USDC)`.
2. Deploy `IdempotentSettlement(mainnet USDC)`.
3. Approve exactly `20,000` USDC6 to Unsafe and `10,000` USDC6 to Idempotent.
4. Unsafe: settle one intent twice. Expect two successful transfers / 20,000 USDC6 recipient delta; Sazume must fail.
5. Idempotent: settle one separate intent, then retry the same ID. Expect one successful transfer and one reverted duplicate / 10,000 USDC6 recipient delta; Sazume must pass.

This is 8 transaction attempts: 2 deployments, 2 approvals, 4 settlement calls. Expected outcomes are 7 successful receipts and 1 reverted receipt. There are 3 successful economic transfers, so principal exposure is `0.030000 USDC`; the reverted duplicate still consumes gas. Capture receipts, blocks, events, before/after recipient ERC-20 balance, intent IDs, gas used, effective price, and derived verdict. Stop at the first unexpected result; never retry a deployment or settlement blindly.

## Read-only estimates observed

Contract creation gas was simulated with `eth_estimateGas` against the listed Mainnet USDC address using compiled fixture initcode and a non-signing placeholder sender. Approval was estimated using `eth_estimateGas` against the existing USDC contract for a 10,000 USDC6 approval. Settlement calls cannot be Mainnet-estimated against these fixtures until they are deployed; the gas figures below are actual accepted Testnet receipts used as planning proxies, not Mainnet estimates.

| Attempt | Gas basis | Gas units |
|---|---|---:|
| Unsafe deployment | Mainnet `eth_estimateGas` | 439,777 |
| Idempotent deployment | Mainnet `eth_estimateGas` | 514,581 |
| Each approval (2) | Mainnet `eth_estimateGas` | 56,012 |
| Unsafe settlement (2) | Accepted Testnet receipt | 64,933 each |
| Idempotent first settlement | Accepted Testnet receipt | 87,404 |
| Idempotent duplicate revert | Accepted Testnet receipt | 25,293 |

At the sampled `eth_gasPrice` of 20,000,000,001 wei, multiplying these units gives an indicative execution cost of `0.026178901310253945 USDC`; adding principal gives `0.056178901310253945 USDC`. This is not a guarantee because half the gas inputs are Testnet proxies.

For a reviewable cap proposal, use a transaction `maxFeePerGas` cap of 40 Gwei (2× the sampled Mainnet base fee) and abort if the current base fee exceeds it. Add 20% gas-limit headroom to each attempt. This yields a gas exposure ceiling of `0.06282952 USDC`; plus `0.030000 USDC` principal, proposed absolute experiment cap `0.09282952 USDC`. A wallet balance floor of `0.100000 USDC` leaves approximately `0.00717048 USDC` above that cap. These are proposed controls, not authorization to spend. Re-estimate all transactions immediately before any later approved execution.

## Required Phase 7B safeguards

- Explicit `SAZUME_MAINNET_EXECUTION=true` opt-in and a separate command; ordinary tests/builds cannot sign or broadcast.
- Verify RPC `eth_chainId === 5042` and the exact configured RPC host before every deployment and transaction; reject Testnet or any other chain.
- Require an explicitly selected disposable signer, show its public address, and require confirmation of that exact address.
- Preflight native18 and ERC-20 USDC6 balances separately; do not sum them.
- Enforce max total gas, max gas fee, max principal, and maximum 8 attempts before signing. No automatic funding or unbounded retries.
- Estimate each call; stop on estimate failure, over-cap totals, unexpected receipt, missing event, balance mismatch, or RPC disagreement. Persist tx evidence before continuing.
- Keep the existing Mainnet block in `packages/arc`; a separately reviewed implementation and explicit human approval are required to remove it.

## Official sources

- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc.md)
- [Contract addresses](https://docs.arc.io/arc/references/contract-addresses.md)
- [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees.md)
- [Deterministic finality](https://docs.arc.io/arc/concepts/deterministic-finality.md)
- [Arc Microgrants eligibility and dates](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
