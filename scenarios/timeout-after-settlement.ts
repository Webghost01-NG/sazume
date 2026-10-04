import type { Scenario } from "../packages/core/src/scenario.js";
import { complete, fulfill, settle } from "./helpers.js";

export const timeoutAfterSettlement = (): Scenario => ({
  name: "timeout-after-settlement",
  async run(context) {
    await settle(context);
    context.trace.add("timeout", context.intent.intentId, { phase: "response-lost-after-settlement" });
    context.trace.add("retry", context.intent.intentId);
    await settle(context);
    await fulfill(context);
    await complete(context);
  },
});
