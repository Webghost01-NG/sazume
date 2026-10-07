import { defineIntent, settlementUniqueness, recipientAmount, fulfillmentUniqueness, completionConsistency } from "../../packages/core/src/index.js";
import { defineConfig } from "../../packages/cli/src/config.js";
import { normal } from "../../scenarios/normal.js";
import { timeoutAfterSettlement } from "../../scenarios/timeout-after-settlement.js";
import { PaidReportAdapter } from "./adapter.js";

const intent = defineIntent({
  id: "PAID-REPORT-42",
  payment: { payer: "customer", recipient: "report-service", asset: { symbol: "USDC", decimals: 6 }, amount: 250_000n },
  invariants: [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()],
});

export default defineConfig({ intent, adapter: new PaidReportAdapter(), scenarios: [normal(), timeoutAfterSettlement()] });
