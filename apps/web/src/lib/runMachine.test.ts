import { describe, expect, it } from "vitest";
import { initialRunState, runMachineReducer } from "./runMachine.js";

describe("experiment run state machine", () => {
  it("moves from configuration through execution and analysis to completion", () => {
    const running = runMachineReducer(initialRunState, { type: "start" });
    expect(running.stage).toBe("running");

    const afterTrace = runMachineReducer(running, { type: "advance-trace", total: 1 });
    expect(afterTrace.stage).toBe("analyzing");
    expect(afterTrace.visibleTraceSteps).toBe(1);

    const complete = runMachineReducer(afterTrace, { type: "advance-analysis", total: 1 });
    expect(complete.stage).toBe("complete");
    expect(complete.visibleAnalysisSteps).toBe(1);
  });

  it("ignores progress events outside their stage and resets a run", () => {
    expect(runMachineReducer(initialRunState, { type: "advance-trace", total: 5 })).toBe(initialRunState);
    const running = runMachineReducer(initialRunState, { type: "start" });
    expect(runMachineReducer(running, { type: "advance-analysis", total: 4 })).toBe(running);
    expect(runMachineReducer(running, { type: "reset" })).toEqual(initialRunState);
  });
});
