# Arc Mainnet qualification runner

**Status: read-only planning completed; broadcast awaits separate approval of the exact generated manifest.** This runner tests the two audited settlement fixtures with the existing `timeout-after-settlement` scenario and invariant engine. It makes at most eight transaction attempts. It never retries an ambiguous submission.

## Runtime configuration

Keep `/home/web-ghost/sazume/.env.mainnet.local` mode 600 and ignored by Git. The runner reads it only when launched with Node's `--env-file` option. Use these exact names:

| Variable | Purpose |
|---|---|
| `SAZUME_MAINNET_RPC_URL` | Approved official Arc Mainnet RPC endpoint |
| `SAZUME_MAINNET_CHAIN_ID` | Must be `5042` if set; actual RPC chain ID is also checked |
| `SAZUME_MAINNET_PUBLIC_ADDRESS` | Disposable signer public address |
| `SAZUME_MAINNET_RECIPIENT_ADDRESS` | Distinct nonzero recipient public address |
| `SAZUME_MAINNET_PRIVATE_KEY` | Disposable signer key, 64 hex characters, optional `0x` prefix; never commit or display |
| `SAZUME_MAINNET_BROADCAST_APPROVAL` | Exact manifest digest, set only after the human approves that final manifest and spend cap |

The generic `PRIVATE_KEY` variable is ignored by this runner. The public signer check derives an address entirely locally; it makes no RPC call and signs nothing:

```bash
node --env-file=.env.mainnet.local --import tsx packages/arc/src/mainnet-qualification.ts --check-signer
```

Read-only plan, including live chain ID, USDC code and decimals, native18/ERC-20 USDC6 balances, fee quote, and deployment estimates:

```bash
npm run test:contracts
node --env-file=.env.mainnet.local --import tsx packages/arc/src/mainnet-qualification.ts --plan --manifest /tmp/sazume-mainnet-manifest.json
```

The plan is a snapshot, not an execution authorization. Review its digest, addresses, fresh estimates, eight transaction rows, 0.030000 USDC maximum principal, 0.104000 USDC hard gas cap, and 0.134000 USDC absolute exposure before any execution approval. The runner rechecks chain, fee, balance, bytecode, and per-step gas estimate before each signing operation. Native18 and ERC-20 USDC6 are two precision views of the same USDC; they must never be added together.

## Execution gate

**Do not run this command until the owner separately approves the final manifest and spending cap.** The command is documented for review, not for this phase:

```bash
SAZUME_MAINNET_BROADCAST_APPROVAL=<approved-manifest-digest> node --env-file=.env.mainnet.local --import tsx packages/arc/src/mainnet-qualification.ts --execute --manifest /tmp/sazume-mainnet-manifest.json
```

The runner persists the transaction hash and nonce before broadcast in a local journal beside the manifest. If the broadcast or receipt is uncertain, it stops and never resubmits automatically. Resume only after read-only chain inspection establishes the exact status. Every confirmed step checks the receipt and its expected economic effect before the next one. The unsafe hero must naturally fail and the idempotent hero must naturally pass; otherwise execution stops. Real evidence is written under `evidence/mainnet/` only after observation.

Arc's [current official event-indexing guide](https://docs.arc.io/integrate/infrastructure/indexing-events) describes a native18 system `Transfer` mirror and a separate USDC6 ERC-20 `Transfer` for an ERC-20 payment. The runner corroborates both emitters by address and unit; it never adds their values as separate payments.

## Post-execution review

After a successful, authorized run, verify the saved `deployments.json`, both hero `run.json` files, and both reports against Arc Explorer. Publish Mainnet claims in the website or README only after this independent check. Preserve historical Testnet evidence and labels. For a judge recording, use a fixed desktop viewport, open the homepage replay and docs, then show the **original** Mainnet explorer transactions and the corroborated evidence. The browser replay is historical evidence; no browser click is a fresh onchain transaction.
