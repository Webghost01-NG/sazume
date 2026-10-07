export type ExperimentStage = "configure" | "running" | "analyzing" | "complete";

export interface RunMachineState {
  stage: ExperimentStage;
  visibleTraceSteps: number;
  visibleAnalysisSteps: number;
}

export type RunMachineAction =
  | { type: "start" }
  | { type: "advance-trace"; total: number }
  | { type: "advance-analysis"; total: number }
  | { type: "reset" };

export const initialRunState: RunMachineState = {
  stage: "configure",
  visibleTraceSteps: 0,
  visibleAnalysisSteps: 0,
};

export function runMachineReducer(state: RunMachineState, action: RunMachineAction): RunMachineState {
  switch (action.type) {
    case "start":
      return { stage: "running", visibleTraceSteps: 0, visibleAnalysisSteps: 0 };
    case "advance-trace": {
      if (state.stage !== "running") return state;
      const visibleTraceSteps = Math.min(state.visibleTraceSteps + 1, action.total);
      return {
        ...state,
        stage: visibleTraceSteps >= action.total ? "analyzing" : "running",
        visibleTraceSteps,
      };
    }
    case "advance-analysis": {
      if (state.stage !== "analyzing") return state;
      const visibleAnalysisSteps = Math.min(state.visibleAnalysisSteps + 1, action.total);
      return {
        ...state,
        stage: visibleAnalysisSteps >= action.total ? "complete" : "analyzing",
        visibleAnalysisSteps,
      };
    }
    case "reset":
      return initialRunState;
  }
}
