import type { Scenario } from "@sazume/core";
import { complete, fulfill, settle } from "./helpers.js";

export const normal = (): Scenario => ({
  name: "normal",
  async run(context) {
    await settle(context);
    await fulfill(context);
    await complete(context);
  },
});
