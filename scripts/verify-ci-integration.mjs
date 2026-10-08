import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const cli = new URL("../packages/cli/bin/sazume.js", import.meta.url);
const run = (args) => spawnSync(process.execPath, [cli.pathname, ...args], {
  encoding: "utf8",
  env: { PATH: process.env.PATH ?? "" },
});

const passing = run(["test", "--adapter", "idempotent", "--json"]);
assert.equal(passing.status, 0, `Expected pass exit 0: ${passing.stderr}`);
const passingReport = JSON.parse(passing.stdout);
assert.equal(passingReport.verdict, "PASS");
assert.equal(passingReport.summary.failed, 0);

const failing = run(["test", "--adapter", "unsafe", "--json"]);
assert.equal(failing.status, 1, `Expected economic failure exit 1: ${failing.stderr}`);
const failingReport = JSON.parse(failing.stdout);
assert.equal(failingReport.verdict, "FAIL");
assert.equal(failingReport.summary.failed, 2);

console.log("CI contract verified: idempotent exits 0; unsafe economic failures exit 1; JSON is parseable.");
