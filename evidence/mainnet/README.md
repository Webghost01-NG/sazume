# Verified Arc Mainnet qualification — 2026-10-14

Sazume executed the separately approved eight-attempt fixture experiment on Arc Mainnet (chain ID 5042). The [independent verification record](independent-verification.json) was produced by re-querying the official RPC after execution; it is separate from the runner's [deployment](deployments.json), [unsafe](hero-unsafe/run.json), and [idempotent](hero-fixed/run.json) records. All files contain public chain data only.

| Economic intent | Receipt evidence | Settlement events | Recipient USDC6 delta | Sazume |
|---|---|---:|---:|---|
| Unsafe timeout after settlement | 2 successful settlement transactions | 2 | +20,000 (0.020000 USDC) | **FAIL** — one obligation paid twice |
| Idempotent timeout after settlement | 1 successful settlement, 1 reverted duplicate | 1 | +10,000 (0.010000 USDC) | **PASS** — one obligation paid once |

Both retries reused their fixture's deterministic economic intent ID. The recipient's historical ERC-20 balance at the four settlement/revert blocks was **10,000 → 20,000 → 30,000 → 30,000 USDC6**. The reverted duplicate emitted no successful settlement or USDC transfer. Seven of the eight transaction receipts succeeded; the eighth intentionally reverted. The actual gas total was **27,922,680,000,000,000 native18 = 0.027922680 USDC**. Principal was **0.030000 USDC**, making actual combined exposure **0.057922680 USDC**, below the approved 0.134000 USDC ceiling. Native18 and ERC-20 USDC6 balances are two views of one USDC asset; they are never added as separate funds.

The deployed fixtures are [`UnsafeSettlement`](https://explorer.arc.io/address/0x8cd2da9e45d18c47a803f065a3625ae68bf37b17) and [`IdempotentSettlement`](https://explorer.arc.io/address/0x0908e0409d593409d251306302fdca0c45198b9c). Their constructor USDC address, deployed runtime code, receipts, events, token transfers, and recipient balance movement were checked. Individual transaction hashes and explorer links are in `independent-verification.json` and the hero run records.

This qualifies the **reference fixture experiment** and Sazume's ability to observe its economic result on Arc Mainnet. It does not prove every external adapter or production payment application is safe. The web experience may replay this historical evidence; opening it never broadcasts a new transaction. Historical [Arc Testnet evidence](../testnet/) remains separate.
