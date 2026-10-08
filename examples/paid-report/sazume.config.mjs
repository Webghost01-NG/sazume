import { defineIntent, settlementUniqueness, recipientAmount, fulfillmentUniqueness, completionConsistency } from "@sazume/core";
import { defineConfig } from "@sazume/cli/config";
import { normal, timeoutAfterSettlement } from "@sazume/cli/scenarios";
import { PaidReportAdapter } from "./adapter.mjs";

const intent = defineIntent({
  id: "PAID-REPORT-42",
  payment: { payer: "customer", recipient: "report-service", asset: { symbol: "USDC", decimals: 6 }, amount: 250_000n },
  invariants: [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()],
});

export default defineConfig({ intent, adapter: new PaidReportAdapter(), scenarios: [normal(), timeoutAfterSettlement()] });
