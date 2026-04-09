import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { api } from "../api/client";
import type { CpqConfigureResponse, CpqStartBody, CpqStartResponse, NormalizedState } from "../../types/bike-builder";
import { useBikeBuilderStore } from "./store";

const DEBOUNCE_MS = 280;

export type UseBikeBuilderOptions = {
  /** Merged into POST /api/cpq/start (e.g. ruleset / namespace from catalogue deep-link). */
  startBody?: CpqStartBody;
  /** Changes to this key reset the session and re-run start. */
  startKey?: string;
};

export function useBikeBuilder(options?: UseBikeBuilderOptions) {
  const startBody = options?.startBody;
  const startKey = options?.startKey ?? "";
  const {
    state,
    isMock,
    isReviewRefreshing,
    isOptionsRefreshing,
    error,
    setStateFromServer,
    applyOptimisticSelection,
    queueSelection,
    clearPending,
    setRefreshing,
    setError,
    reset,
  } = useBikeBuilderStore();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CpqStartResponse>("/cpq/start", startBody ?? {});
      return data;
    },
    onSuccess: (data) => {
      if (!data.ok || !data.state) {
        setError(data.error ?? "Start failed");
        return;
      }
      setStateFromServer(data.state as NormalizedState, data.mock);
    },
    onError: () => setError("Network error starting configuration"),
  });

  const flushConfigure = useCallback(async () => {
    const pending = [...useBikeBuilderStore.getState().pendingSelections];
    if (pending.length === 0) return;

    useBikeBuilderStore.getState().clearPending();
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRefreshing({ review: true, options: true });
    const clientRequestId = crypto.randomUUID();

    try {
      const { data } = await api.post<CpqConfigureResponse>(
        "/cpq/configure",
        { selections: pending, clientRequestId },
        { signal: ac.signal },
      );

      if (ac.signal.aborted) return;

      if (!data.ok || !data.state) {
        setError(data.error ?? "Configure failed");
        return;
      }

      setStateFromServer(data.state as NormalizedState, data.mock);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "name" in e && (e as { name?: string }).name === "CanceledError") {
        return;
      }
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "ERR_CANCELED") {
        return;
      }
      setError("Network error configuring");
    } finally {
      if (!ac.signal.aborted) {
        setRefreshing({ review: false, options: false });
      }
    }
  }, [setError, setRefreshing, setStateFromServer]);

  const scheduleFlush = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void flushConfigure();
    }, DEBOUNCE_MS);
  }, [flushConfigure]);

  const selectOption = useCallback(
    (cpqOptionId: string, value: string) => {
      applyOptimisticSelection(cpqOptionId, value);
      queueSelection(cpqOptionId, value);
      scheduleFlush();
    },
    [applyOptimisticSelection, queueSelection, scheduleFlush],
  );

  useEffect(() => {
    reset();
    startMutation.mutate();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap when route/query changes
  }, [startKey]);

  const resetBuild = useCallback(async () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await api.post("/cpq/reset", {});
    reset();
    startMutation.mutate();
  }, [reset, startMutation]);

  const finalize = useCallback(async () => {
    const { data } = await api.post<{ ok: boolean; error?: string }>("/cpq/finalize", {});
    if (!data.ok) {
      setError(data.error ?? "Finalize failed");
    }
  }, [setError]);

  return {
    state,
    isMock,
    isLoading: startMutation.isPending,
    isReviewRefreshing,
    isOptionsRefreshing,
    error,
    selectOption,
    resetBuild,
    finalize,
  };
}
