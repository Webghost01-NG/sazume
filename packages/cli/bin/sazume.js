#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(packageRoot, "../..");
const tsxCli = resolve(projectRoot, "node_modules/tsx/dist/cli.mjs");
const entry = resolve(packageRoot, "src/index.ts");
const result = spawnSync(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) {
  process.stderr.write(`Unable to start Sazume CLI: ${result.error.message}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
