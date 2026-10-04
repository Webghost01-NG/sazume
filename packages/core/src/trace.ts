export type TraceType =
  | "settlement-attempt"
  | "settlement-observed"
  | "fulfillment-attempt"
  | "fulfillment-observed"
  | "timeout"
  | "retry"
  | "callback";

export interface TraceEntry {
  sequence: number;
  type: TraceType;
  intentId: string;
  metadata?: Record<string, string | number | boolean>;
}

export class ScenarioTrace {
  readonly entries: TraceEntry[] = [];

  add(type: TraceType, intentId: string, metadata?: TraceEntry["metadata"]): void {
    this.entries.push({ sequence: this.entries.length + 1, type, intentId, ...(metadata ? { metadata } : {}) });
  }
}
