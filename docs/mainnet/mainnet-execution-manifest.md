# Proposed Arc Mainnet qualification manifest

> Historical audit snapshot. A bounded runner now exists; see [qualification-runner.md](qualification-runner.md). The generated digest-bearing manifest and separate owner approval govern any future execution. This document alone never authorizes a broadcast.

**Status: DRAFT / NO-GO / NO BROADCAST AUTHORIZED.** Prepared 2026-10-14 from the audited fixture source. This is a transaction plan, not transaction evidence. No deployment address, transaction hash, block, signer, recipient or wallet balance has been invented. The current repository has **no Mainnet write command**; `packages/arc` rejects chain ID 5042 for execution.

## Preconditions requiring a separately reviewed executor

1. Use the exact audited fixture bytecode after the `TOKEN_HAS_NO_CODE` fix, `UnsafeSettlement` and `IdempotentSettlement`; both constructors receive `0x3600000000000000000000000000000000000000`. Verify constructor argument, deployed `usdc()` and bytecode before approval. These fixtures are for measurement, not production funds custody.
2. Select and separately approve one disposable Mainnet signer and a distinct recipient. **Sender: UNSET. Recipient: UNSET.** Do not derive either from the existing Testnet `PRIVATE_KEY`; this audit did not inspect that secret. Record only the public addresses in the final approved manifest.
3. Verify the actual RPC `eth_chainId` is 5042 before every attempted write, the URL is the approved official endpoint, USDC has code and `decimals() = 6`, the selected signer matches the approved public address, and the recipient differs from the payer and is not zero.
4. Read the signer's native18 and ERC-20 USDC6 views and recipient ERC-20 USDC6 baseline. They are two precision views of one asset; **never add them**. Require at least **0.150000 USDC** in the economic balance, with enough native18 to cover the 0.104000 USDC gas cap and enough USDC6 to cover 0.030000 USDC principal. Balance readiness is currently **UNKNOWN** because `SAZUME_MAINNET_PUBLIC_ADDRESS` is unset.
5. Produce two fresh, high-entropy, unique human intent IDs, one per fixture, then derive deterministic machine IDs with `defineIntent`. Save each ID before sending; reuse the same machine ID for that fixture's retry. Reject previously settled IDs. Keep payer/recipient/amount checks independent of the event's `intentId` topic.
6. Require explicit transaction-by-transaction opt-in, a hard eight-attempt count, the gas and principal caps below, bounded receipt polling, evidence persistence before the next call, and immediate abort on mismatch. Never auto-fund or auto-resubmit an uncertain transaction. A missing receipt is *uncertain*, not a failed transaction.

## Fixed financial limits

Qualification settlement: **10,000 USDC6 = 0.010000 USDC**. Exact allowances: Unsafe **20,000 USDC6**, Idempotent **10,000 USDC6**. Maximum successful principal: **30,000 USDC6 = 0.030000 USDC**. Per-transaction maximum fee: **40 Gwei**. Total gas-limit ceiling: **2,600,000**. Ceiling gas cost: **104,000,000,000,000,000 native18 = 0.104000 USDC**. **Absolute proposed spend cap: 0.134000 USDC.** Wallet floor: **0.150000 USDC**. These are limits to enforce in a future reviewed runner, not an authorization to use them.

At the 2026-10-14 RPC quote of 20,000,001,041 wei, the full gas-limit ceiling costs 52,000,002,706,600,000 native18 (rounding *up* to 52,001 USDC6), giving a quote-based total ceiling of **0.082001 USDC** including principal. Fees can change. Abort if a fresh base fee or gas-price quote exceeds 40 Gwei. Settlement gas cannot be honestly estimated until each fixture is deployed; obtain fresh `eth_estimateGas` for every subsequent call, then apply the hard per-call limit. Before deployment, read-only `eth_estimateGas` reported 481,326 and 556,118 gas for the new fixture bytecodes, and 56,000 gas per current USDC approval.

## Ordered attempt manifest

Every row uses **Arc Mainnet chain 5042**. The sender in all rows is the approved disposable signer (currently **UNSET**). Gas exposure is the maximum `gasLimit × 40 Gwei`, not an estimate of actual cost. Contract addresses are unknown until deployment receipts are verified. The sole economic recipient is the approved distinct recipient (currently **UNSET**); deployment and approval transactions have no payment recipient.

| # | Type and target/function | Token amount | Gas limit / max exposure | Expected state change and verification | Stop condition |
|---|---|---:|---:|---|---|
| 1 | DEPLOY `UnsafeSettlement(USDC)` | 0 | 600,000 / 0.024000 USDC | Success receipt, code at returned address, `usdc()` equals official USDC; persist hash/block/gas | Revert, missing receipt, wrong code or constructor arg, over cap |
| 2 | DEPLOY `IdempotentSettlement(USDC)` | 0 | 650,000 / 0.026000 USDC | Same checks for second fixture | Same; do not redeploy #1 automatically |
| 3 | APPROVAL `USDC.approve(unsafe, 20,000)` | 0 transferred | 75,000 / 0.003000 USDC | Success receipt and exact allowance 20,000 | Revert, unexpected allowance, wrong spender |
| 4 | APPROVAL `USDC.approve(idempotent, 10,000)` | 0 transferred | 75,000 / 0.003000 USDC | Success receipt and exact allowance 10,000 | Revert, unexpected allowance, wrong spender |
| 5 | SETTLEMENT `unsafe.settle(unsafeIntentId, recipient, 10,000)` | 10,000 USDC6 | 300,000 / 0.012000 USDC | One success receipt, one matching `IntentSettled`, one matching USDC transfer, recipient +10,000 USDC6 | Any receipt/event/balance mismatch; persist before retry |
| 6 | RETRY same `unsafeIntentId`, same contract/recipient/amount | 10,000 USDC6 | 300,000 / 0.012000 USDC | Second success receipt/event/transfer; cumulative recipient +20,000 USDC6; Sazume settlement uniqueness and recipient amount fail | Any different intent ID or evidence discrepancy; stop before fixed hero |
| 7 | SETTLEMENT `idempotent.settle(fixedIntentId, recipient, 10,000)` | 10,000 USDC6 | 300,000 / 0.012000 USDC | Success receipt, one event/transfer, recipient +10,000 USDC6 for this hero | Any mismatch |
| 8 | EXPECTED REVERT same `fixedIntentId`, same contract/recipient/amount | 0 transferred | 300,000 / 0.012000 USDC | Reverted receipt/custom error, no second event/transfer, recipient unchanged; Sazume passes | A success receipt, transfer, missing/uncertain receipt, or wrong revert reason |

There are **eight attempts**, expected **seven successful receipts and one reverted receipt**, **two deployments**, **two approvals**, and **three actual transfers**. A reverted attempt still pays gas. The stop policy forbids chasing a green result: no automatic replacement transaction after a timeout, no second run of a scenario under another ID, and no continuation after an inconsistent or uncertain receipt. If a transaction was submitted but its receipt is unavailable, first resolve its hash and nonce read-only; treat spending as unknown until reconciled.

## Exact currently available commands

```bash
npm run preflight:arc-mainnet
npm test
npm run test:contracts
```

The preflight is read-only and currently exits nonzero because no Mainnet public signer address is configured. **There is no safe Mainnet execution command to provide yet.** The above commands do not deploy or spend. A future execution command must be implemented, audited and reviewed with the completed sender/recipient/balance fields and fresh fee quote before seeking separate human spending approval. Do not substitute direct `forge create --broadcast` or `cast send` commands; they would bypass the manifest guards.

## Sources

[RPC parameters and load-balancing warning](https://docs.arc.io/arc/references/rpc-endpoints) · [USDC address and decimals](https://docs.arc.io/arc/references/contract-addresses) · [gas model](https://docs.arc.io/arc/references/gas-and-fees) · [finality](https://docs.arc.io/arc/concepts/deterministic-finality) · [one USDC balance in two precisions](https://www.arc.io/blog/usdc-for-every-action-how-arc-simplifies-building-onchain).
