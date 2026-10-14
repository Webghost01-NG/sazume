# Arc Mainnet evidence checklist

**Planned evidence only. No Arc Mainnet transactions exist in this repository.** Use this after a separate audited executor and explicit approval of the completed [execution manifest](mainnet-execution-manifest.md). Evidence must be copied from actual RPC responses, not from expected values in a plan.

## Before the first transaction

- [ ] Preserve the exact approved manifest revision, code commit, compiler settings, fixture creation bytecode hashes, eight-attempt limit, per-call gas limits, 40 Gwei fee cap, 0.030000 USDC principal cap and 0.134000 USDC combined cap.
- [ ] Record UTC capture time separately from Arc block timestamps. Record the exact official RPC URL and actual `eth_chainId = 5042` response. Confirm USDC address code and `decimals() = 6`.
- [ ] Record approved signer and recipient **public** addresses; confirm distinct/nonzero. Preserve no key, seed phrase, auth header or provider credential in output.
- [ ] Read sender native18 and ERC-20 USDC6 balance views; compare after unit conversion, never sum. Read recipient ERC-20 USDC6 baseline. Confirm funding floor with fresh balances and fee quote.
- [ ] Generate unique human/machine IDs for the unsafe and fixed obligations. Check both have not previously been settled by the respective fixture. Keep the ID identical within each retry.

## For each attempted transaction

- [ ] Verify chain ID, approved RPC, approved signer, transaction count and remaining principal/gas/total budget again **before signing**.
- [ ] Capture exact calldata, to/from addresses, nonce, gas limit, max fee and maximum exposure before submission. Validate constructor USDC address and settlement recipient/amount against the manifest.
- [ ] If broadcast is separately authorized, persist the returned transaction hash immediately. Never infer a hash from local signing alone.
- [ ] Read the actual receipt: status, block number/hash, `gasUsed`, `effectiveGasPrice`, gas cost as exact `gasUsed × effectiveGasPrice` native18, and a separately labeled USDC6 conversion. Retain native18 remainder when USDC6 truncates.
- [ ] Treat missing receipt as unresolved. Arc's documented finality applies **after inclusion in a committed block**; it does not make an unconfirmed or missing transaction failed. Do not auto-resubmit.
- [ ] Decode `IntentSettled` only from the expected fixture address and transaction hash. Match intent ID, payer, recipient and 10,000 USDC6 amount. Count no event from a reverted receipt.
- [ ] Check the canonical USDC ERC-20 transfer evidence and recipient balance delta. Match one successful settlement to +10,000 USDC6; for fixed duplicate require no transfer and no balance change. Consider the Arc system emitter and avoid counting a mirrored native transfer as a second asset movement.
- [ ] Compare receipt status, fixture event(s), USDC transfer evidence and recipient delta. Any disagreement is `OBSERVER INCONSISTENCY`; stop. Persist the discrepancy without inventing a verdict.
- [ ] Confirm a fixed duplicate revert has the documented `IntentAlreadySettled` reason when available; if Arc exposes a missing receipt or another revert form, stop and investigate.

## Required files after an approved execution

```text
evidence/mainnet/deployments.json
evidence/mainnet/hero-unsafe/run.json
evidence/mainnet/hero-unsafe/report.txt
evidence/mainnet/hero-fixed/run.json
evidence/mainnet/hero-fixed/report.txt
```

`deployments.json` should contain the verified chain ID, USDC address, fixture addresses and bytecode hashes, constructor arguments, deployment/approval receipt data, allowance reads and public identities. Each `run.json` should contain the approved manifest identifier, fresh intent IDs and retry equality, amount units, the recipient before/after/delta, actual receipts and logs, gas details, fulfillment count, the unmodified core invariant results, and verdict. `report.txt` should summarize the same observed data with Mainnet explorer links of the form `https://explorer.arc.io/tx/{actualHash}`. Use the receipt's real hash only.

## Stop and review

- Stop after any unexpected receipt, event, balance delta, USDC/chain mismatch, fee/gas estimate above cap, low balance, changed signer/recipient, expired approval, exhausted transaction count, missing evidence, or unconfirmed transaction.
- Preserve partial evidence if a deployment or unsafe transfer already occurred. Never rerun the hero solely to obtain an expected result.
- Report spent gas and principal independently. Include reverted transaction gas. Do not present testnet receipts, local simulations or this checklist as Mainnet evidence.
