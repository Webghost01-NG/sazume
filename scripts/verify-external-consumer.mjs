import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const temp = await mkdtemp(join(tmpdir(), "sazume-external-consumer-"));
const coreTarballDir = join(temp, "tarballs");
const consumer = join(temp, "consumer");
await (await import("node:fs/promises")).mkdir(coreTarballDir, { recursive: true });
await (await import("node:fs/promises")).mkdir(consumer, { recursive: true });

execFileSync(npm, ["pack", "--workspace", "@sazume/core", "--pack-destination", coreTarballDir], { cwd: root, stdio: "ignore" });
execFileSync(npm, ["pack", "--workspace", "@sazume/cli", "--pack-destination", coreTarballDir], { cwd: root, stdio: "ignore" });
const coreTarball = join(coreTarballDir, "sazume-core-0.1.0-rc.1.tgz");
const cliTarball = join(coreTarballDir, "sazume-cli-0.1.0-rc.1.tgz");

await writeFile(join(consumer, "package.json"), JSON.stringify({ name: "external-sazume-consumer", private: true, type: "module" }, null, 2));
execFileSync(npm, ["install", "--offline", "--no-audit", coreTarball, cliTarball], { cwd: consumer, stdio: "ignore" });

await writeFile(join(consumer, "consumer.mjs"), `
import assert from "node:assert/strict";
import { defineIntent, settlementUniqueness, recipientAmount, fulfillmentUniqueness, completionConsistency, sazume } from "@sazume/core";
import { normal, timeoutBeforeSettlement, timeoutAfterSettlement, duplicateCallback } from "@sazume/cli/scenarios";

class StoreAdapter {
  settlements = 0;
  total = 0n;
  fulfillments = 0;
  completed = false;
  async settle(intent) { this.settlements += 1; this.total += intent.payment.amount; return { accepted: true, amount: intent.payment.amount }; }
  async fulfill() { this.fulfillments += 1; return { accepted: true }; }
  async markComplete() { this.completed = true; }
  async observe(intent) { return { intentId: intent.intentId, settlement: { count: this.settlements, totalAmount: this.total }, fulfillment: { count: this.fulfillments }, completed: this.completed }; }
  async reset() { this.settlements = 0; this.total = 0n; this.fulfillments = 0; this.completed = false; }
}

const intent = defineIntent({ id: "EXTERNAL-ORDER-9", payment: { payer: "customer", recipient: "report-service", asset: { symbol: "USDC", decimals: 6 }, amount: 250_000n }, invariants: [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()] });
const result = await sazume.run({ intent, adapter: new StoreAdapter(), scenarios: [normal(), timeoutBeforeSettlement(), timeoutAfterSettlement(), duplicateCallback()] });
assert.deepEqual(result.scenarios.map((item) => item.passed), [true, true, false, false]);
assert.equal(result.scenarios[2].outcome.settlement.count, 2);
assert.equal(result.scenarios[2].outcome.settlement.totalAmount, 500_000n);
assert.equal(result.scenarios[3].outcome.fulfillment.count, 2);
assert.ok(result.scenarios[2].invariants.some((item) => item.name === "Settlement uniqueness" && !item.passed));
assert.ok(result.scenarios[3].invariants.some((item) => item.name === "Fulfillment uniqueness" && !item.passed));
assert.ok(result.scenarios[2].trace.every((entry) => entry.intentId === intent.intentId));
console.log(JSON.stringify({ packageImports: "pass", scenarios: result.scenarios.map(({ scenario, passed, outcome }) => ({ scenario, verdict: passed ? "PASS" : "FAIL", settlements: outcome.settlement.count, fulfillments: outcome.fulfillment.count })) }));
`);

await writeFile(join(consumer, "custom.config.mjs"), `
import { defineIntent, settlementUniqueness, recipientAmount, fulfillmentUniqueness, completionConsistency } from "@sazume/core";
import { defineConfig } from "@sazume/cli/config";
import { normal, timeoutBeforeSettlement, timeoutAfterSettlement, duplicateCallback } from "@sazume/cli/scenarios";
class CustomAdapter {
  settlements = 0; total = 0n; fulfillments = 0; completed = false;
  async settle(intent) { this.settlements++; this.total += intent.payment.amount; return { accepted: true, amount: intent.payment.amount }; }
  async fulfill() { this.fulfillments++; return { accepted: true }; }
  async markComplete() { this.completed = true; }
  async observe(intent) { return { intentId: intent.intentId, settlement: { count: this.settlements, totalAmount: this.total }, fulfillment: { count: this.fulfillments }, completed: this.completed }; }
  async reset() { this.settlements=0; this.total=0n; this.fulfillments=0; this.completed=false; }
}
const intent = defineIntent({ id: "EXTERNAL-ORDER-CLI", payment: { payer: "payer", recipient: "merchant", asset: { symbol: "USDC", decimals: 6 }, amount: 42_000n }, invariants: [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()] });
export default defineConfig({ intent, adapter: new CustomAdapter(), scenarios: [normal(), timeoutBeforeSettlement(), timeoutAfterSettlement(), duplicateCallback()] });
`);

await writeFile(join(consumer, "types.mts"), `import { defineIntent, settlementUniqueness, type EconomicAdapter, type EconomicOutcome, type Scenario } from "@sazume/core";\nimport { normal } from "@sazume/cli/scenarios";\nconst adapter: EconomicAdapter = {} as EconomicAdapter;\nconst scenario: Scenario = normal();\nvoid adapter; void scenario;\n`);
await writeFile(join(consumer, "types.cts"), `import core = require("@sazume/core");\nconst intent = core.defineIntent({ id: "CJS", payment: { payer: "a", recipient: "b", asset: { symbol: "USDC", decimals: 6 }, amount: 1n }, invariants: [core.settlementUniqueness()] });\nvoid intent;\n`);

const require = createRequire(join(consumer, "consumer.mjs"));
const cjsCore = require("@sazume/core");
assert.equal(typeof cjsCore.defineIntent, "function", "CommonJS export should load");
execFileSync(process.execPath, [join(consumer, "consumer.mjs")], { cwd: consumer, stdio: "inherit" });
const cliPath = join(consumer, "node_modules", ".bin", "sazume");
const cli = spawnSync(cliPath, ["test", "--config", "custom.config.mjs", "--json"], { cwd: consumer, encoding: "utf8" });
assert.equal(cli.status, 1, cli.stderr);
assert.equal(cli.stderr, "");
const json = JSON.parse(cli.stdout);
assert.deepEqual(json.scenarios.map((item) => item.verdict), ["PASS", "PASS", "FAIL", "FAIL"]);
assert.equal(json.scenarios[2].outcome.settlement.count, 2);

const tsc = resolve(root, "node_modules/.bin/tsc");
execFileSync(process.execPath, [tsc, "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "types.mts", "types.cts"], { cwd: consumer, stdio: "ignore" });
const pkgCore = JSON.parse(await readFile(join(consumer, "node_modules/@sazume/core/package.json"), "utf8"));
const pkgCli = JSON.parse(await readFile(join(consumer, "node_modules/@sazume/cli/package.json"), "utf8"));
console.log(JSON.stringify({ externalInstall: "pass", esmImport: "pass", commonJsRequire: "pass", publicDeclarations: "pass", packagedCli: "pass", cliMatrix: json.scenarios.map((item) => [item.scenario, item.verdict]), packageNames: [pkgCore.name, pkgCli.name], tempProject: consumer }, null, 2));
