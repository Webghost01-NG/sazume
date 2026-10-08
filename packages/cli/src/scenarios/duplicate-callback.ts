import type { Scenario } from "@sazume/core";
import { complete, fulfill, settle } from "./helpers.js";

export const duplicateCallback = (): Scenario => ({
  name: "duplicate-callback",
  async run(context) {
    await settle(context);
    context.trace.add("callback", context.intent.intentId, { delivery: 1 });
    await fulfill(context);
    context.trace.add("callback", context.intent.intentId, { delivery: 2, duplicate: true });
    await fulfill(context);
    await complete(context);
  },
});
