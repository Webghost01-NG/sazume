import type { Scenario } from "../packages/core/src/scenario.js";
import { complete, fulfill, settle } from "./helpers.js";

export const timeoutBeforeSettlement = (): Scenario => ({
  name: "timeout-before-settlement",
  async run(context) {
    context.trace.add("timeout", context.intent.intentId, { phase: "before-settlement" });
    context.trace.add("retry", context.intent.intentId);
    await settle(context);
    await fulfill(context);
    await complete(context);
  },
});
