# Sazume final deadline audit

**Date:** 2026-10-14 (UTC). **Decision: NO-GO for Arc Mainnet broadcast.** This is an internal source and evidence review, not an independent third-party security audit. No Mainnet transaction was signed or sent.

## Baseline and scope

- Audit branch: `audit/final-deadline-mainnet-go-no-go`, created from clean `main` at `4df48413b763776a833903a395c0387b8980a9d4`. `main` matched `origin/main` after fetch. The six merged PRs and `v0.1.0-rc.1` release were inspected; GitHub CI at that commit passed.
- Public npm registry returned `@sazume/core@0.1.0-rc.1` and `@sazume/cli@0.1.0-rc.1`; both `next` tags resolve to that version. `latest` still points to the temporary `0.0.0-stage`, so installation guidance correctly specifies `@next`.
- Homepage and `/docs/getting-started` returned HTTP 200. README and web copy explicitly identify Arc Testnet evidence as a historical replay and Mainnet as unqualified.
- Reviewed both settlement fixtures, safe transfer library, core invariants and runner, Arc adapter and observer, Testnet qualification corroboration, Mainnet read-only preflight and budget, CLI, package manifests, CI, README and evidence files. No Mainnet signer address was configured. A separate `PRIVATE_KEY` environment variable exists; its value was neither read nor used by this audit.

## Findings

| ID | Severity | Status | Finding and impact |
|---|---|---|---|
| F-01 | HIGH | **Fixed on audit branch** | `contracts/src/IERC20.sol`: a low-level call to an address without code returns success and empty data. Both fixtures could emit `IntentSettled` although no token moved if deployed with an EOA token address. Added a code-presence check before the call. `testNoCodeTokenCannotCreateFalseSettlementEvidence` proves both calls revert, fixed state rolls back, and no settlement event appears. Ordinary local matrix remains 2/4 versus 4/4. A malicious contract that lies about transfers still requires independent balance corroboration. |
| F-02 | HIGH release blocker | **Unresolved** | `packages/arc/src/client.ts`, `config.ts`, `adapter.ts`, and `docs/mainnet-preflight.md`: writes to chain 5042 are deliberately disabled. There is no reviewed Mainnet executor that binds a signer, gas/transaction/principal limits, receipt/event/balance reconciliation, and durable stop-on-inconsistency evidence. Raw `forge create --broadcast` or `cast send` would bypass the intended safeguards. No broadcast command is supplied by this audit. |
| F-03 | MEDIUM evidence risk | **Unresolved for Mainnet** | `packages/arc/src/observer.ts` derives settlement from a successful receipt plus fixture event, while `qualify-testnet.ts` separately corroborates recipient ERC-20 balance delta. The generic adapter alone cannot establish a Mainnet economic transfer. Before broadcasting, a reviewed qualification runner must compare receipt, matching event, USDC transfer evidence, and before/after recipient state, and surface `OBSERVER INCONSISTENCY`. |
| F-04 | MEDIUM | **Documented fixture limitation** | `contracts/src/IdempotentSettlement.sol`: `settled[intentId]` is global and does not commit the expected payer, recipient or amount. A third party knowing an unused ID can pay a small amount first and prevent the intended call. Test IDs must be fresh, non-reused and withheld until execution; every event must be checked against the approved payer/recipient/amount. Any mismatch is an immediate stop. The fixture is not a production payment contract. |
| F-05 | MEDIUM product limitation | **Unchanged** | `packages/core/src/invariant.ts`: recipient amount is checked when `outcome.completed` is true; completion consistency likewise does not require a workflow to complete. A custom adapter that incorrectly reports `completed=false` can evade underpayment detection. The qualified scenarios call `markComplete`, but integrators must treat adapter observation quality as part of their trust boundary. This does not justify changing the validated core during this deadline audit. |
| F-06 | LOW operational | **Documented** | Circle's Mainnet RPC is load-balanced and may answer adjacent reads from backends at different heights (`-32014`). A future runner must retry that *read* after a bounded backoff and verify the receipt's block. It must never automatically resubmit a transaction because a read failed. |

The duplicate execution allowed by `UnsafeSettlement` is intentional, observed economic failure, not a security claim about a production contract. The fixed fixture sets its idempotency bit before the token call; an external-call failure reverts that state and its event atomically. Neither contract has an admin or upgrade path. Both use 6-decimal ERC-20 transfer amounts. Gas is paid in Arc's native18 representation of the same USDC, never added as another asset balance.

## Reproduced behavior and regressions

| Environment / command | Unsafe | Idempotent | Evidence |
|---|---|---|---|
| `npm run demo` | PASS, PASS, FAIL, FAIL | PASS, PASS, PASS, PASS | Same core runner and intent, observed settlement/fulfillment counts. |
| Published CLI `--json` | 2/4, exit 1 | 4/4, exit 0 | Actual public npm installation in a clean `/tmp` consumer. Unsafe timeout-after alone exited 1. |
| `npm run demo:arc-local` | 2/4 | 4/4 | Ordinary Anvil only; transactions/receipts observed, not Arc Mainnet. |
| Saved Arc Testnet qualification | 2/4 | 4/4 | `evidence/testnet/` includes receipts, matching events and recipient USDC6 deltas. Hero unsafe: two successful receipts/events, +20,000 USDC6; fixed: one success, one revert, one event, +10,000 USDC6. These are previously recorded Testnet observations, not fresh Mainnet evidence. |

`npm ci` passed with zero reported vulnerabilities; `npm test` passed **54/54**; `npm run test:contracts` passed **5/5** after F-01; `npm run typecheck`, `npm run build`, `npm run demo:arc-local`, `npm run test:external-consumer`, and `npm audit --audit-level=low` passed. The external consumer verified ESM, CommonJS, declarations, packaged CLI, custom config and expected exit codes. Current local Node was 22.23.1; the last successful GitHub CI matrix at baseline covered Node 20.19, 22.12 and 24. The isolated `arc-forge` binary was not on this shell's PATH; prior Arc Foundry and live Testnet qualification remain historical evidence, not rerun claims.

## Mainnet read-only observations

On 2026-10-14 at 19:05:23 UTC, the canonical RPC returned chain ID **5042**, block **25,969,120**, base fee **20,000,000,000 wei**, gas-price quote **20,000,001,041 wei**, deployed code at `0x3600000000000000000000000000000000000000`, and ERC-20 `decimals() = 6`. New compiled fixture initcode estimates: Unsafe **481,326 gas**, Idempotent **556,118 gas**; current USDC approval estimates: **56,000 gas each**. Settlement calls cannot be accurately estimated before fixture deployment. The read-only preflight exited 1 solely because `SAZUME_MAINNET_PUBLIC_ADDRESS` is unset; it reported `broadcastAuthorized: false`.

The proposed eight-attempt cap remains **2,600,000 gas × 40 Gwei = 0.104000 USDC native18 gas exposure**. Principal allowances cap transfers at **0.030000 USDC6**. Maximum proposed exposure is **0.134000 USDC**, with a **0.150000 USDC** wallet funding floor. At the sampled gas-price quote, the same gas-limit ceiling plus principal is approximately **0.082001 USDC** after conservative USDC6 rounding; it is a quote, not a promise. See [execution manifest](../mainnet/mainnet-execution-manifest.md) for transaction-by-transaction limits and the unfilled identities.

## Decision

**NO-GO today.** F-01 is fixed locally, but no funded Mainnet public signer/recipient pair is identified and F-02/F-03 prevent a controlled, corroborated execution. The audit branch and tests must be reviewed and merged; then a separate Mainnet runner and its negative tests must be reviewed against the manifest. Obtain a fresh read-only balance/fee quote and explicit approval of the final manifest before any spend. This document is not spending authorization.

## Primary Arc sources checked 2026-10-14

- [Official RPC endpoints, chain IDs and load-balanced read caveat](https://docs.arc.io/arc/references/rpc-endpoints)
- [Official contract addresses and USDC ERC-20 interface](https://docs.arc.io/arc/references/contract-addresses)
- [Gas and fees, including 20 Gwei floor](https://docs.arc.io/arc/references/gas-and-fees)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences)
- [Deterministic finality](https://docs.arc.io/arc/concepts/deterministic-finality)
- [Arc's one-balance, two-precision explanation](https://www.arc.io/blog/usdc-for-every-action-how-arc-simplifies-building-onchain)
