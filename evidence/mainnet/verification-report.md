# Independent Arc Mainnet evidence review

**Result: VERIFIED.** Official RPC `https://rpc.mainnet.arc.io`, chain ID **5042**. Manifest digest `0x94a0d44233095754e70dab9304ff59232892dc66a8837710df3a436e6b77943b`. Signer `0x6CeD8D6Bad8Dfd2e60BCEA116fE74548f959f1F2`; recipient `0xD1819994E1DB34Cd2BA460607E248B4c6d3925c7`. Application payment used the official six-decimal USDC ERC-20 interface at `0x3600000000000000000000000000000000000000`.

The verifier independently fetched every transaction and receipt, checked input, nonce, payer, status, gas, contract code and USDC constructor value, decoded fixture `IntentSettled` and both distinct USDC Transfer emitters, and read the recipient ERC-20 balance. The native18 Transfer is a mirror of the USDC6 movement, not additional value. The data is serialized in [independent-verification.json](independent-verification.json).

| Step | Receipt | Block | Gas used | Transaction |
|---|---|---:|---:|---|
| Unsafe deployment | success | 25974232 | 476,378 | [0x5e7218…cd9a3a](https://explorer.arc.io/tx/0x5e7218d1358683f5ec616362e664c94fad3a99c99c41c6f73ecd3c2fe7cd9a3a) |
| Idempotent deployment | success | 25974238 | 550,581 | [0x04223d…bafed](https://explorer.arc.io/tx/0x04223d64a2f928ad1f1864868b4bb78ae3c0040874934cb0274d73a59a2bafed) |
| Unsafe approval | success | 25974243 | 55,426 | [0xcb52fa…69f93](https://explorer.arc.io/tx/0xcb52fa5436bd842503b66c3e0758668bacbc71f51ad8b27c4ee151efabb69f93) |
| Idempotent approval | success | 25974248 | 55,426 | [0x27d095…06f7ef](https://explorer.arc.io/tx/0x27d0956d972fa8d66f46424fad4208775bb998c626e1b96819687ff40c06f7ef) |
| Unsafe settlement #1 | success | 25974254 | 90,061 | [0x7c3a42…7b988](https://explorer.arc.io/tx/0x7c3a429a23348a33b19a9fda5dc770b43cdf38094de97f573e0ba95c8077b988) |
| Unsafe retry, same intent | success | 25974260 | 60,261 | [0x9c06cc…9b133c](https://explorer.arc.io/tx/0x9c06cc30b06b42a7fa1833d60595e472f47ddbb2be2557f6b6cd67350d9b133c) |
| Idempotent settlement #1 | success | 25974266 | 82,720 | [0xc98f31…89c785](https://explorer.arc.io/tx/0xc98f318e595ae79054ac7ea90b639686fb899f792eb9547c709655d42689c785) |
| Idempotent duplicate | **reverted** | 25974272 | 25,281 | [0x95bb43…9ba7b](https://explorer.arc.io/tx/0x95bb4341272fbfb53170fe81191d4d15e86093fddcf1190297fcb74b5dd9ba7b) |

Every receipt reported an effective gas price of **20,000,000,000 wei**. Total gas: **1,396,134 gas**, costing **27,922,680,000,000,000 native18 (0.027922680 USDC)**. Three successful 0.010000 USDC transfers moved **0.030000 USDC principal**. The payer's native18 balance fell from 1,000,000,000,000,000,000 to 942,077,320,000,000,000; that difference equals principal plus gas exactly. The recipient's USDC6 balance changed from 0 to 30,000 and historical reads at the four settlement/revert blocks yielded 10,000, 20,000, 30,000, and 30,000 respectively.

The unsafe hero failed settlement uniqueness and recipient amount; the idempotent hero passed all four invariants. The offchain fulfillment count was one in each run. The journal ended `complete`, with eight confirmed receipts and no unresolved attempt. No claim is made about untested application adapters or browser-executed transactions.
