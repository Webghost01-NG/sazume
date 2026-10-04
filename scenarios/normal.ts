import type { Scenario } from "../packages/core/src/scenario.js";
import { complete, fulfill, settle } from "./helpers.js";

export const normal = (): Scenario => ({
  name: "normal",
  async run(context) {
    await settle(context);
    await fulfill(context);
    await complete(context);
  },
});
