import { defineIntent, fulfillmentUniqueness, recipientAmount, report, sazume, settlementUniqueness, completionConsistency } from "../packages/core/src/index.js";
import { duplicateCallback } from "../scenarios/duplicate-callback.js";
import { normal } from "../scenarios/normal.js";
import { timeoutAfterSettlement } from "../scenarios/timeout-after-settlement.js";
import { timeoutBeforeSettlement } from "../scenarios/timeout-before-settlement.js";
import { FixedAdapter } from "./fixed-adapter.js";
import { UnsafeAdapter } from "./unsafe-adapter.js";

const intent = defineIntent({
  id: "ORDER-7F21",
  payment: { payer: "customer", recipient: "merchant", asset: { symbol: "USDC", decimals: 6 }, amount: 1_000_000n },
  invariants: [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()],
});
const scenarios = [normal(), timeoutBeforeSettlement(), timeoutAfterSettlement(), duplicateCallback()];

for (const [label, adapter] of [["UNSAFE", new UnsafeAdapter()], ["FIXED", new FixedAdapter()]] as const) {
  const result = await sazume.run({ intent, adapter, scenarios });
  console.log(report(result, label));
  console.log("");
}
