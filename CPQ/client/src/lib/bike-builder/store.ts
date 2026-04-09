import { create } from "zustand";
import type { NormalizedState } from "../../types/bike-builder";

export type BikeBuilderStore = {
  state: NormalizedState | null;
  isMock: boolean;
  configureVersion: number;
  lastAppliedRequestId: string | null;
  pendingSelections: { id: string; value: string }[];
  isReviewRefreshing: boolean;
  isOptionsRefreshing: boolean;
  error: string | null;

  setStateFromServer: (s: NormalizedState, isMock?: boolean) => void;
  applyOptimisticSelection: (cpqOptionId: string, value: string) => void;
  queueSelection: (id: string, value: string) => void;
  clearPending: () => void;
  bumpConfigureVersion: () => number;
  setAppliedRequestId: (id: string | null) => void;
  setRefreshing: (opts: { review?: boolean; options?: boolean }) => void;
  setError: (e: string | null) => void;
  reset: () => void;
};

const initial = {
  state: null as NormalizedState | null,
  isMock: false,
  configureVersion: 0,
  lastAppliedRequestId: null as string | null,
  pendingSelections: [] as { id: string; value: string }[],
  isReviewRefreshing: false,
  isOptionsRefreshing: false,
  error: null as string | null,
};

export const useBikeBuilderStore = create<BikeBuilderStore>((set, get) => ({
  ...initial,

  setStateFromServer: (s, isMock) =>
    set({
      state: s,
      isMock: isMock ?? get().isMock,
      error: null,
    }),

  applyOptimisticSelection: (cpqOptionId, value) =>
    set((st) => {
      if (!st.state) return st;
      const features = st.state.features.map((f) => {
        if (f.cpqOptionId !== cpqOptionId) return f;
        const opt = f.options.find((o) => o.value === value);
        return {
          ...f,
          selectedValue: value,
          selectedCaption: opt?.caption ?? value,
        };
      });
      return { state: { ...st.state, features } };
    }),

  queueSelection: (id, value) =>
    set((st) => {
      const next = st.pendingSelections.filter((p) => p.id !== id);
      next.push({ id, value });
      return { pendingSelections: next };
    }),

  clearPending: () => set({ pendingSelections: [] }),

  bumpConfigureVersion: () => {
    const v = get().configureVersion + 1;
    set({ configureVersion: v });
    return v;
  },

  setAppliedRequestId: (id) => set({ lastAppliedRequestId: id }),

  setRefreshing: (opts) =>
    set((st) => ({
      isReviewRefreshing: opts.review ?? st.isReviewRefreshing,
      isOptionsRefreshing: opts.options ?? st.isOptionsRefreshing,
    })),

  setError: (e) => set({ error: e }),

  reset: () => set({ ...initial }),
}));
