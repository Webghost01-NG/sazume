# After a separately approved Mainnet qualification

Do not change product claims until the authorized run has completed and an independent reviewer has checked the evidence.

1. Compare `evidence/mainnet/deployments.json` with both Arc Explorer deployment receipts. Confirm chain 5042, constructor USDC address, runtime code, block, gas and signer.
2. For each `evidence/mainnet/hero-*/run.json`, check the original settlement transaction hashes, receipt statuses, `IntentSettled` logs, official USDC6 Transfer logs, native18 mirror logs and recipient balance deltas. Confirm the retry reused the exact intent ID.
3. Confirm the unsafe result is economically FAIL with two successful settlements and +0.020000 USDC; confirm the fixed result is PASS with one successful settlement and a reverted duplicate, +0.010000 USDC. Treat any discrepancy as a stop, not a publication opportunity.
4. Update homepage and documentation with a separate **Arc Mainnet verified** evidence source, deployed addresses, original explorer links and captured blocks. Keep the existing historical **Arc Testnet verified replay** intact. Never imply a browser replay broadcasts a transaction.
5. Add a factual README Mainnet section only after independent evidence review. Link exact public evidence files and disclose the amount actually used.

## Recording readiness

- Use the production homepage and `/docs` at 1440×900 and a mobile viewport. Confirm the production commit and no broken links.
- Open original Explorer transactions and the checked evidence JSON before recording. Show Testnet and Mainnet labels separately.
- Verify no `.env` file, terminal history containing a key, wallet popup, or private operational document can enter the recording.
- Record only after the user provides the judge-facing script. This checklist does not authorize a recording or Mainnet transaction.
