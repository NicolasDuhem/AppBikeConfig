import type { NormalizedState } from "../../types/bike-builder";

/** Replace local view-model with CPQ-authoritative server snapshot */
export function applyServerSnapshot(_prev: NormalizedState | null, next: NormalizedState): NormalizedState {
  return JSON.parse(JSON.stringify(next)) as NormalizedState;
}
