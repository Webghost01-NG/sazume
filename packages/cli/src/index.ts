#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { defineIntent, fulfillmentUniqueness, recipientAmount, sazume, settlementUniqueness, completionConsistency } from "@sazume/core";
import type { EconomicInvariant, Scenario } from "@sazume/core";
import { normal } from "./scenarios/normal.js";
import { timeoutBeforeSettlement } from "./scenarios/timeout-before-settlement.js";
import { timeoutAfterSettlement } from "./scenarios/timeout-after-settlement.js";
import { duplicateCallback } from "./scenarios/duplicate-callback.js";
import { FixedAdapter } from "./reference/fixed-adapter.js";
import { UnsafeAdapter } from "./reference/unsafe-adapter.js";
import type { SazumeConfig } from "./config.js";

const packageMetadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
const VERSION = packageMetadata.version;
const scenarioFactories: Record<string, () => Scenario> = {
  normal,
  "timeout-before-settlement": timeoutBeforeSettlement,
  "timeout-after-settlement": timeoutAfterSettlement,
  "duplicate-callback": duplicateCallback,
};

interface Options { adapter?: string; scenario?: string; json: boolean; trace: boolean; config?: string; help?: boolean }

const USAGE = `Sazume economic reliability testing\n\nUsage:\n  sazume test [options]\n  sazume --help\n\nOptions:\n  --adapter <unsafe|idempotent>  Run a bundled reference adapter\n  --scenario <id>                Run one canonical scenario\n  --config <path>                Load a trusted local ESM/CommonJS config\n  --trace                        Print deterministic scenario trace events\n  --json                         Print the versioned JSON report only\n  --help                         Show this help\n\nScenario IDs: ${Object.keys(scenarioFactories).join(", ")}\n\nConfigs execute as local code. Only load files you trust.`;

function parseArgs(args: string[]): Options {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") return { json: false, trace: false, help: true };
  if (args[0] !== "test") throw new Error("Expected the `test` command. Run `sazume --help` for usage.");
  const options: Options = { json: false, trace: false };
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    if (arg === "--json") options.json = true;
    else if (arg === "--trace") options.trace = true;
    else if (arg === "--adapter" || arg === "--scenario" || arg === "--config") {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      if (arg === "--adapter") options.adapter = value;
      else if (arg === "--scenario") options.scenario = value;
      else options.config = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.adapter && !["unsafe", "idempotent"].includes(options.adapter)) throw new Error(`Unknown adapter "${options.adapter}". Choose unsafe or idempotent.`);
  if (options.adapter && options.config) throw new Error("Choose either --adapter or --config, not both.");
  if (options.scenario && !Object.hasOwn(scenarioFactories, options.scenario)) throw new Error(`Unknown scenario "${options.scenario}". Choose: ${Object.keys(scenarioFactories).join(", ")}.`);
  return options;
}

function referenceConfig(adapterName: "unsafe" | "idempotent", selectedScenario?: string): SazumeConfig {
  const invariants: EconomicInvariant[] = [settlementUniqueness(), recipientAmount(), fulfillmentUniqueness(), completionConsistency()];
  return {
    intent: defineIntent({
      id: "ORDER-7F21",
      payment: { payer: "customer", recipient: "merchant", asset: { symbol: "USDC", decimals: 6 }, amount: 1_000_000n },
      invariants,
    }),
    adapter: adapterName === "unsafe" ? new UnsafeAdapter() : new FixedAdapter(),
    scenarios: selectedScenario ? [scenarioFactories[selectedScenario]()] : Object.values(scenarioFactories).map((factory) => factory()),
  };
}

async function loadConfig(path?: string): Promise<SazumeConfig> {
  const configPath = resolve(process.cwd(), path ?? "sazume.config.mjs");
  if (!/\.(?:mjs|cjs|js)$/.test(configPath)) throw new Error("Config must be executable JavaScript (.mjs, .js, or .cjs). Compile TypeScript config files first.");
  let loaded: { default?: SazumeConfig; config?: SazumeConfig };
  try {
    loaded = await import(pathToFileURL(configPath).href) as typeof loaded;
  } catch (error) {
    throw new Error(`Could not load ${configPath}: ${error instanceof Error ? error.message : String(error)}. Create sazume.config.mjs or pass --adapter unsafe|idempotent.`);
  }
  const config = loaded.default ?? loaded.config;
  if (!config || !config.intent || !config.adapter || !Array.isArray(config.scenarios)) throw new Error("Config must default-export { intent, adapter, scenarios }.");
  return config;
}

function validateConfig(config: SazumeConfig): void {
  if (!config.intent || typeof config.intent.id !== "string" || !config.intent.id.trim() || typeof config.intent.intentId !== "string") throw new Error("Config intent must have a non-empty id and deterministic intentId.");
  if (!config.intent.payment || typeof config.intent.payment.amount !== "bigint" || config.intent.payment.amount <= 0n) throw new Error("Config payment amount must be a positive bigint in USDC6 units.");
  if (!Array.isArray(config.intent.invariants) || config.intent.invariants.length === 0 || config.intent.invariants.some((item) => !item || typeof item.evaluate !== "function")) throw new Error("Config intent must provide at least one valid economic invariant.");
  if (!config.adapter || ["settle", "fulfill", "markComplete", "observe", "reset"].some((method) => typeof (config.adapter as unknown as Record<string, unknown>)[method] !== "function")) throw new Error("Config adapter must implement settle, fulfill, markComplete, observe, and reset.");
  if (!Array.isArray(config.scenarios) || config.scenarios.length === 0 || config.scenarios.some((scenario) => !scenario || typeof scenario.name !== "string" || typeof scenario.run !== "function")) throw new Error("Config must provide at least one valid scenario.");
}

function displayAmount(value: bigint): string {
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")} USDC`;
}

function renderText(result: Awaited<ReturnType<typeof sazume.run>>, adapterName: string, trace: boolean): string {
  const lines = ["SAZUME", "ECONOMIC RELIABILITY", "", `Adapter       ${adapterName}`, `Intent        ${result.intent.id}`, `Amount        ${displayAmount(result.intent.payment.amount)}`, "", "SCENARIO                         RESULT", "────────────────────────────────────────"];
  const labels: Record<string, string> = { normal: "Normal", "timeout-before-settlement": "Timeout before settlement", "timeout-after-settlement": "Timeout after settlement", "duplicate-callback": "Duplicate callback" };
  for (const scenario of result.scenarios) lines.push(`${(labels[scenario.scenario] ?? scenario.scenario).padEnd(33)} ${scenario.passed ? "✓ PASS" : "× FAIL"}`);
  for (const scenario of result.scenarios.filter((item) => !item.passed)) {
    lines.push("", "FAILURE", "", labels[scenario.scenario] ?? scenario.scenario);
    for (const invariant of scenario.invariants.filter((item) => !item.passed)) {
      const observed = invariant.name === "Recipient amount" ? displayAmount(scenario.outcome.settlement.totalAmount) : invariant.observed;
      lines.push("", invariant.name, `Expected                         ${invariant.expected}`, `Observed                         ${observed}`);
    }
  }
  if (trace) for (const scenario of result.scenarios) {
    lines.push("", `TRACE · ${scenario.scenario.toUpperCase()}`);
    for (const entry of scenario.trace) lines.push(`${String(entry.sequence).padStart(2, "0")} ${entry.type}  ${entry.intentId}`);
  }
  const passed = result.scenarios.filter((item) => item.passed).length;
  lines.push("", `Economic settlement              ${result.scenarios.some((item) => item.outcome.settlement.count) ? "OBSERVED" : "NONE"}`, `Economic intent                  ${result.passed ? "PRESERVED" : "NOT PRESERVED"}`, "", `${passed} / ${result.scenarios.length} scenarios passed`);
  return lines.join("\n");
}

function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, entry) => typeof entry === "bigint" ? entry.toString() : entry));
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  let options: Options;
  try { options = parseArgs(argv); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (argv.includes("--json")) process.stdout.write(`${JSON.stringify({ schemaVersion: 1, version: VERSION, error: { code: "USAGE_ERROR", message } })}\n`);
    else process.stderr.write(`${message}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.help) { process.stdout.write(`${USAGE}\n`); process.exitCode = 0; return; }
  try {
    let config: SazumeConfig;
    let adapterName: string;
    if (options.adapter) {
      config = referenceConfig(options.adapter as "unsafe" | "idempotent", options.scenario);
      adapterName = options.adapter;
    } else {
      config = await loadConfig(options.config);
      if (options.scenario) config = { ...config, scenarios: [scenarioFactories[options.scenario]()] };
      adapterName = config.adapter.constructor?.name ?? "custom";
    }
    validateConfig(config);
    const result = await sazume.run(config);
    if (options.json) {
      const scenarios = result.scenarios.map(({ scenario, outcome, invariants, trace, passed }) => ({ scenario, verdict: passed ? "PASS" : "FAIL", passed, outcome, invariants, trace }));
      process.stdout.write(`${JSON.stringify(jsonSafe({ schemaVersion: 1, version: VERSION, adapter: adapterName, intent: result.intent, scenarios, outcomes: scenarios.map(({ scenario, outcome }) => ({ scenario, ...outcome })), verdict: result.passed ? "PASS" : "FAIL", summary: { passed: scenarios.filter((item) => item.passed).length, failed: scenarios.filter((item) => !item.passed).length } }), null, 2)}\n`);
    } else process.stdout.write(`${renderText(result, adapterName, options.trace)}\n`);
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) process.stdout.write(`${JSON.stringify({ schemaVersion: 1, version: VERSION, error: { code: "EXECUTION_ERROR", message } })}\n`);
    else process.stderr.write(`Sazume test failed: ${message}\n`);
    process.exitCode = 1;
  }
}

export { main, parseArgs, referenceConfig };
