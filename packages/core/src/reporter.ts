import type { SazumeRunResult } from "./runner.js";

function formatAmount(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction} USDC`;
}

export function report(result: SazumeRunResult, label: string): string {
  const lines = ["SAZUME", `Economic Reliability Test — ${label}`, "────────────────────────────────", ""];
  if (label.toUpperCase() === "UNSAFE") {
    lines.push(`Intent        ${result.intent.id}`, `Expected      ${formatAmount(result.intent.payment.amount)}`, "");
  }
  for (const scenario of result.scenarios) {
    lines.push(`${scenario.passed ? "✓" : "✕"} ${scenario.scenario}`);
    if (!scenario.passed) {
      lines.push("", "ECONOMIC INVARIANT VIOLATION");
      for (const item of scenario.invariants.filter((invariant) => !invariant.passed)) {
        lines.push("", item.name, `  expected    ${item.expected}`, `  observed    ${item.name === "Recipient amount" ? formatAmount(scenario.outcome.settlement.totalAmount) : item.observed}`);
      }
      lines.push("", "TRACE");
      for (const entry of scenario.trace) lines.push(`  ${String(entry.sequence).padStart(2, "0")} ${entry.type}`);
    }
  }
  const passed = result.scenarios.filter((scenario) => scenario.passed).length;
  const failed = result.scenarios.length - passed;
  lines.push("", "────────────────────────────────", `${passed} passed`, `${failed} failed`, "", result.passed ? "ECONOMIC INTENT PRESERVED" : "ECONOMIC INTENT NOT PRESERVED");
  return lines.join("\n");
}
