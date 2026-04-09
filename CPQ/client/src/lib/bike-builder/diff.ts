import type { NormalizedState } from "../../types/bike-builder";

/** Shallow compare selection state for skipping redundant UI work */
export function selectionsFingerprint(state: NormalizedState): string {
  return state.features
    .filter((f) => f.isVisible)
    .map((f) => `${f.cpqOptionId}:${f.selectedValue}`)
    .join("|");
}
