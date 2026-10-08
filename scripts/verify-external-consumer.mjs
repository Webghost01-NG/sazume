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

execFileSync(npm, ["run", "build:packages"], { cwd: root, stdio: "ignore" });

const coreManifest = JSON.parse(await readFile(join(root, "packages/core/package.json"), "utf8"));
const cliManifest = JSON.parse(await readFile(join(root, "packages/cli/package.json"), "utf8"));
assert.equal(coreManifest.version, cliManifest.version, "public packages must use the same prerelease version");
assert.equal(cliManifest.dependencies["@sazume/core"], coreManifest.version, "CLI must depend on the matching core release");
for (const manifest of [coreManifest, cliManifest]) {
  assert.equal(manifest.private, undefined, "approved package manifests must be publishable");
  assert.equal(manifest.license, "MIT", "package metadata must match the repository license");
  assert.equal(manifest.engines.node, ">=20.19.0");
  assert.deepEqual(manifest.publishConfig, { access: "public", tag: "next", registry: "https://registry.npmjs.org/" });
}

function packInfo(workspace) {
  const output = execFileSync(npm, ["pack", `--workspace=${workspace}`, "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" });
  const [info] = JSON.parse(output);
  assert.equal(info.name, workspace);
  assert.equal(info.version, coreManifest.version);
  const paths = info.files.map(({ path }) => path);
  assert.ok(paths.includes("package.json"));
  assert.ok(paths.includes("README.md"));
  assert.ok(paths.includes("LICENSE"));
  assert.ok(paths.every((path) => !/(^|\/)(?:\.env(?:\.|$)|evidence|node_modules|contracts|\.git)(\/|$)/i.test(path)), `${workspace} tarball must exclude secrets, private evidence, dependencies, contracts, and git files`);
  assert.ok(paths.every((path) => workspace === "@sazume/core"
    ? ["README.md", "LICENSE", "package.json"].includes(path) || path.startsWith("dist/")
    : ["README.md", "LICENSE", "package.json", "bin/sazume.js"].includes(path) || path.startsWith("dist/")), `${workspace} tarball contains an unreviewed path`);
  return { info, paths };
}

const corePack = packInfo("@sazume/core");
const cliPack = packInfo("@sazume/cli");
for (const target of ["dist/esm/index.js", "dist/esm/index.d.ts", "dist/cjs/index.js", "dist/cjs/index.d.ts"]) assert.ok(corePack.paths.includes(target), `core tarball must contain ${target}`);
for (const target of ["bin/sazume.js", "dist/index.js", "dist/index.d.ts", "dist/config.js", "dist/config.d.ts", "dist/scenarios/index.js", "dist/scenarios/index.d.ts"]) assert.ok(cliPack.paths.includes(target), `CLI tarball must contain ${target}`);
assert.ok((cliPack.info.files.find(({ path }) => path === "bin/sazume.js")?.mode ?? 0) & 0o111, "CLI bin must be executable in its tarball");

const corePackResult = JSON.parse(execFileSync(npm, ["pack", "--workspace=@sazume/core", "--pack-destination", coreTarballDir, "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }))[0];
const cliPackResult = JSON.parse(execFileSync(npm, ["pack", "--workspace=@sazume/cli", "--pack-destination", coreTarballDir, "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }))[0];
const coreTarball = join(coreTarballDir, corePackResult.filename);
const cliTarball = join(coreTarballDir, cliPackResult.filename);

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
assert.equal(json.version, coreManifest.version, "CLI report version must come from packaged metadata");
const unsafeCli = spawnSync(cliPath, ["test", "--adapter", "unsafe", "--json"], { cwd: consumer, encoding: "utf8" });
assert.equal(unsafeCli.status, 1, unsafeCli.stderr);
assert.deepEqual(JSON.parse(unsafeCli.stdout).scenarios.map(({ verdict }) => verdict), ["PASS", "PASS", "FAIL", "FAIL"]);
const fixedCli = spawnSync(cliPath, ["test", "--adapter", "idempotent", "--json"], { cwd: consumer, encoding: "utf8" });
assert.equal(fixedCli.status, 0, fixedCli.stderr);
assert.deepEqual(JSON.parse(fixedCli.stdout).scenarios.map(({ verdict }) => verdict), ["PASS", "PASS", "PASS", "PASS"]);

const tsc = resolve(root, "node_modules/.bin/tsc");
execFileSync(process.execPath, [tsc, "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "types.mts", "types.cts"], { cwd: consumer, stdio: "ignore" });
const pkgCore = JSON.parse(await readFile(join(consumer, "node_modules/@sazume/core/package.json"), "utf8"));
const pkgCli = JSON.parse(await readFile(join(consumer, "node_modules/@sazume/cli/package.json"), "utf8"));
console.log(JSON.stringify({ externalInstall: "pass", esmImport: "pass", commonJsRequire: "pass", publicDeclarations: "pass", packagedCli: "pass", customAdapterConfig: "pass", unsafeExitCode: unsafeCli.status, idempotentExitCode: fixedCli.status, packageFileAllowlist: "pass", cliMatrix: json.scenarios.map((item) => [item.scenario, item.verdict]), packageNames: [pkgCore.name, pkgCli.name], tempProject: consumer }, null, 2));
