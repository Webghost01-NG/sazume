import { createHash } from "node:crypto";
import type { EconomicInvariant } from "./invariant.js";

export interface EconomicIntent {
  id: string;
  intentId: string;
  payment: {
    payer: string;
    recipient: string;
    asset: { symbol: "USDC"; decimals: 6 };
    amount: bigint;
  };
  invariants: EconomicInvariant[];
}

type IntentInput = Omit<EconomicIntent, "intentId">;

export function defineIntent(input: IntentInput): EconomicIntent {
  if (input.payment.amount <= 0n) throw new Error("Intent amount must be positive");
  if (!input.id.trim()) throw new Error("Intent ID must not be empty");
  const intentId = createHash("sha256").update(`sazume:intent:v1:${input.id}`).digest("hex");
  return { ...input, intentId };
}
