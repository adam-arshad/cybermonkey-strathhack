import type { Scenario, ScoreResult } from "./types";
export function validateData(data: Scenario): true;
export function scoreSelection(
  data: Scenario,
  selection: string[],
): ScoreResult;
