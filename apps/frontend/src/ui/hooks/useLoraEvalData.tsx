import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listProjectEvals,
  listProjectLoras,
  listSharedEvals,
  listSharedLoras,
  type LoraEval,
  type LoraRecord,
} from "../api";
import { useAsyncAction } from "./useAsyncAction";

export function useLoraEvalData(opts: { projectId: string; scope: "project" | "baseline" }) {
  const { projectId, scope } = opts;
  const [loras, setLoras] = useState<LoraRecord[]>([]);
  const [evals, setEvals] = useState<LoraEval[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAction = useAsyncAction(async () => {
    if (scope === "project" && !projectId) {
      setLoras([]);
      setEvals([]);
      return;
    }
    const [lorasResult, evalsResult] =
      scope === "baseline"
        ? await Promise.all([listSharedLoras(), listSharedEvals()])
        : await Promise.all([listProjectLoras(projectId), listProjectEvals(projectId)]);
    setLoras(lorasResult.loras ?? []);
    setEvals(evalsResult.evals ?? []);
  });

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await fetchAction.run();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setLoras([]);
      setEvals([]);
    }
  }, [fetchAction]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh, projectId, scope]);

  return useMemo(
    () => ({
      loras,
      evals,
      loading: fetchAction.loading,
      error,
      refresh,
    }),
    [loras, evals, fetchAction.loading, error, refresh],
  );
}
