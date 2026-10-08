# Arc Mainnet preflight — no broadcast authorized

**Status: READ-ONLY PREFLIGHT COMPLETE — BROADCAST NOT AUTHORIZED.** Refreshed 2026-10-08. The Arc runtime package still rejects chain ID 5042; no Mainnet deployment or signing path was added. Run `npm run preflight:arc-mainnet` to repeat read-only checks. It does not read a private key, sign, or submit transactions.

## Verified network data

Current Circle docs list Arc Mainnet chain ID `5042`, canonical RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`, and USDC contract `0x3600000000000000000000000000000000000000`. The ERC-20 `decimals()` call returns 6. The same underlying USDC is exposed as native 18-decimal gas balance; never add native and ERC-20 views. Arc docs describe EIP-1559 with EWMA fee smoothing, a 20,000 Gwei maximum base fee, and sub-second deterministic finality. The EVM-differences page says the mempool enforces a 20 Gwei `maxFeePerGas` floor; the gas table labels its 20 Gwei minimum-base-fee parameter as Testnet. The proposed 40 Gwei maximum fee is above both the documented floor and today's sampled 20 Gwei Mainnet base fee. Abort if either the current base fee or gas-price quote exceeds the cap.

The official Mainnet explorer uses transaction detail routes of the form `https://explorer.arc.io/tx/{transactionHash}`. The Testnet explorer is separate; never link a Mainnet run to a Testnet URL.

The earlier Circle RPC HTTP 403 was transient and is not currently reproducible. Current Arc docs explicitly list Circle, Blockdaemon, dRPC, and QuickNode RPC endpoints; unauthenticated read-only calls to all four succeeded without bypassing authentication or service controls. At `2026-10-08T00:28:57Z`, all returned chain ID `5042`, USDC decimals `6`, and deployed bytecode at the USDC address. Their latest sampled heights were `24,815,607`–`24,815,615`; each reported base fee `20,000,000,000` wei and gas price `20,000,001,001` wei. The dedicated read-only preflight at `2026-10-08T00:32:58Z` returned block `24,816,089`, hash `0x5b857e938bdd06eeb69e300d3d47df42fd786f16f9779e21b855e01319c567ea`, the same base fee and gas price, and `1,798` bytes of USDC code. These are point-in-time observations, not fee guarantees. No Mainnet public signer address is configured.

## Minimum qualification plan

Use two fixture contracts and one unique intent per implementation, each for `0.010000 USDC` (`10,000` USDC6). The amount is a recommendation based on the accepted Testnet experiment, not a Mainnet execution.

1. Deploy `UnsafeSettlement(mainnet USDC)`.
2. Deploy `IdempotentSettlement(mainnet USDC)`.
3. Approve exactly `20,000` USDC6 to Unsafe and `10,000` USDC6 to Idempotent.
4. Unsafe: settle one intent twice. Expect two successful transfers / 20,000 USDC6 recipient delta; Sazume must fail.
5. Idempotent: settle one separate intent, then retry the same ID. Expect one successful transfer and one reverted duplicate / 10,000 USDC6 recipient delta; Sazume must pass.

This is 8 transaction attempts: 2 deployments, 2 approvals, 4 settlement calls. Expected outcomes are 7 successful receipts and 1 reverted receipt. There are 3 successful economic transfers, so principal exposure is `0.030000 USDC`; the reverted duplicate still consumes gas. Capture receipts, blocks, events, before/after recipient ERC-20 balance, intent IDs, gas used, effective price, and derived verdict. Stop at the first unexpected result; never retry a deployment or settlement blindly.

## Refreshed read-only estimates and hard limits

Contract creation gas was simulated with `eth_estimateGas` against the listed Mainnet USDC address using compiled fixture initcode and a synthetic non-signing caller. Approval was estimated using `eth_estimateGas` against the existing USDC contract for the exact 20,000/10,000 USDC6 allowances. The current four official RPC endpoints returned identical estimates. Settlement calls cannot be estimated against these fixtures until deployed. Their Testnet receipt gas is shown only as an expected-cost proxy; the maximum-spend calculation instead uses explicit per-call gas limits.

| Attempt | Gas basis | Gas units |
|---|---|---:|
| Unsafe deployment | Mainnet `eth_estimateGas` | 439,777 |
| Idempotent deployment | Mainnet `eth_estimateGas` | 514,581 |
| Each approval (2) | Mainnet `eth_estimateGas` | 56,000 |
| Unsafe settlement #1 | Accepted Testnet receipt | 89,933 |
| Unsafe retry settlement | Accepted Testnet receipt | 64,933 |
| Idempotent first settlement | Accepted Testnet receipt | 87,404 |
| Idempotent duplicate revert | Accepted Testnet receipt | 25,293 |

The previous table incorrectly used 64,933 gas for both Unsafe calls. Accepted evidence records 89,933 gas for the first Unsafe settlement and 64,933 for the retry. Correcting that gives a planning total of `1,333,921` gas: Mainnet-estimated deployments and approvals plus four observed Testnet settlement receipts. At the sampled `eth_gasPrice` of `20,000,001,001` wei, this is `26,678,421,335,254,921` native18 (`0.026678 USDC6` after truncation). With `0.030000 USDC` principal, the indicative total is `0.056678 USDC` after USDC6 truncation. It is not a Mainnet settlement gas estimate or a guarantee.

The read-only budget helper uses a `40 Gwei` maximum fee cap (2× the sampled base fee) and fixed gas limits: 600,000 and 650,000 for deployment, 75,000 per approval, and 300,000 per settlement attempt. It refuses readiness if the sampled base fee exceeds the proposed cap. Across eight attempts, the total gas-limit ceiling is `2,600,000`; at 40 Gwei this caps gas at `0.104000 USDC`. Add the maximum `0.030000 USDC` principal for a **maximum spend of `0.134000 USDC`**. The recommended wallet funding floor is `0.150000 USDC`, leaving `0.016000 USDC` above the cap. Any actual plan must stay within each individual limit, eight transactions, and the total cap. These are proposed controls, not authorization to spend.

`npm run preflight:arc-mainnet` recompiles the fixtures if needed, checks chain ID and USDC metadata, estimates both deployments and approvals through the selected official RPC, and prints the budget. It only loads a public-address variable named `SAZUME_MAINNET_PUBLIC_ADDRESS` for balance reads. Without that public address it exits non-zero after reporting that signer/balance readiness is blocked. It does not read a private key or contain a transaction submission client. Select an alternate documented RPC with `ARC_MAINNET_READ_RPC_URL` set to one of the four exact URLs listed above. No API-key endpoint is included.

## Required Phase 7B safeguards

- A future Mainnet transaction runner is not implemented. It must be a separate command with explicit opt-in; ordinary tests/builds must remain unable to sign or broadcast.
- Verify RPC `eth_chainId === 5042` and the exact configured RPC host before every deployment and transaction; reject Testnet or any other chain.
- Require an explicitly selected disposable signer, show its public address, and require confirmation of that exact address.
- Preflight native18 and ERC-20 USDC6 balances separately; do not sum them.
- Enforce max total gas, max gas fee, max principal, and maximum 8 attempts before signing. No automatic funding or unbounded retries.
- Re-estimate each call; stop on estimate failure, over-cap totals, unexpected receipt, missing event, balance mismatch, or RPC disagreement. Persist tx evidence before continuing.
- Keep the existing Mainnet block in `packages/arc`; a separately reviewed implementation and explicit human approval are required to remove it.

## Evidence capture shape

`evidence/mainnet/` currently contains no Mainnet transactions. After a separately approved execution exists, save only observed data:

```text
evidence/mainnet/deployments.json
evidence/mainnet/hero-unsafe/run.json
evidence/mainnet/hero-unsafe/report.txt
evidence/mainnet/hero-fixed/run.json
evidence/mainnet/hero-fixed/report.txt
```

Each transaction record must preserve its attempt kind, hash, receipt status, block number, gas used, effective gas price, raw native18 gas cost, and truncated USDC6 gas reporting. Each hero run must include actual chain/RPC, contract and USDC addresses, human and machine intent IDs, retry identity equality, per-intent event logs and amounts, recipient ERC-20 USDC6 before/after/delta, fulfillment count, invariant results, and verdict. Store no private key, credential, expected placeholder hash, or fabricated timestamp. The captured block hash and timestamp are RPC observations; a local capture time must be labelled separately.

The live workflow must stop before the next transaction if the prior receipt, matching events, contract address, or recipient balance delta disagree. Do not retry a deployment, settlement, or failed confirmation automatically.

## Commands and current execution boundary

Safe repeatable commands today:

```bash
npm run preflight:arc-mainnet
ARC_MAINNET_READ_RPC_URL=https://rpc.blockdaemon.mainnet.arc.io npm run preflight:arc-mainnet
npm test
npm run test:contracts
```

There is deliberately **no Mainnet deployment or qualification command** in this branch. `arcConfigFromEnv` and `ArcEconomicAdapter` remain Testnet-only and reject chain ID `5042`. The `assertArcMainnetWritePlan` helper is pure validation and is not connected to a signer or transaction client. Creating an execution command requires a separate reviewed implementation and explicit spend approval; do not substitute raw `forge create --broadcast` or `cast send` commands because they bypass Sazume's plan controls.

## Official sources

- [RPC endpoints and network parameters](https://docs.arc.io/arc/references/rpc-endpoints.md)
- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc.md)
- [Contract addresses](https://docs.arc.io/arc/references/contract-addresses.md)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences.md)
- [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees.md)
- [RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints.md)
- [Deterministic finality](https://docs.arc.io/arc/concepts/deterministic-finality.md)
- [Arc Microgrants eligibility and dates](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
