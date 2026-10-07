import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const executable = resolve(root, "node_modules/.bin/sazume");

function invoke(...args: string[]) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(PRIVATE_KEY|MNEMONIC|SEED|ARC_RPC|RPC_URL)/i.test(key)));
  return spawnSync(process.execPath, [executable, ...args], { cwd: root, encoding: "utf8", env });
}

describe("Sazume CLI executable behavior", () => {
  it("returns non-zero for unsafe full and hero runs, with core-derived failures", () => {
    const full = invoke("test", "--adapter", "unsafe");
    expect(full.status).toBe(1);
    expect(full.stdout).toContain("Timeout after settlement");
    expect(full.stdout).toContain("2 / 4 scenarios passed");
    const hero = invoke("test", "--adapter", "unsafe", "--scenario", "timeout-after-settlement");
    expect(hero.status).toBe(1);
    const json = JSON.parse(invoke("test", "--adapter", "unsafe", "--scenario", "timeout-after-settlement", "--json").stdout);
    expect(json.scenarios[0].invariants.some((invariant: { name: string; passed: boolean }) => invariant.name === "Settlement uniqueness" && !invariant.passed)).toBe(true);
    expect(json.scenarios[0].verdict).toBe("FAIL");
    expect(json.outcomes[0].settlement.count).toBe(2);
    expect(json.scenarios[0].trace.every((entry: { intentId: string }) => entry.intentId === json.intent.intentId)).toBe(true);
  });

  it("returns zero for idempotent full and hero runs", () => {
    expect(invoke("test", "--adapter", "idempotent").status).toBe(0);
    expect(invoke("test", "--adapter", "idempotent", "--scenario", "timeout-after-settlement").status).toBe(0);
  });

  it("rejects unknown adapter/scenario and emits clean JSON", () => {
    const adapter = invoke("test", "--adapter", "mystery");
    expect(adapter.status).toBe(2);
    expect(adapter.stderr).toContain("Unknown adapter");
    const scenario = invoke("test", "--adapter", "unsafe", "--scenario", "random-failure");
    expect(scenario.status).toBe(2);
    expect(scenario.stderr).toContain("Unknown scenario");
    const output = invoke("test", "--adapter", "idempotent", "--json");
    expect(output.status).toBe(0);
    expect(() => JSON.parse(output.stdout)).not.toThrow();
    expect(output.stdout.startsWith("{")).toBe(true);
    expect(output.stderr).toBe("");
    const missingConfig = invoke("test", "--config", "does-not-exist.ts");
    expect(missingConfig.status).toBe(1);
    expect(missingConfig.stderr).toContain("Could not load");
    const conflict = invoke("test", "--adapter", "unsafe", "--config", "sazume.config.ts");
    expect(conflict.status).toBe(2);
    expect(conflict.stderr).toContain("either --adapter or --config");
  });

  it("runs an external application config and selected canonical scenario", () => {
    const result = invoke("test", "--config", "examples/paid-report/sazume.config.ts", "--scenario", "timeout-after-settlement", "--trace");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PaidReportAdapter");
    expect(result.stdout).toContain("retry");
  });

  it("needs no RPC, key, or network setup", () => {
    const result = invoke("test", "--adapter", "idempotent", "--scenario", "normal");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 / 1 scenarios passed");
  });
});
