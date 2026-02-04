import { useCallback, useEffect, useState } from "react";

import { getJobLog } from "../api";

export function useJobLog(opts: { projectId: string; jobId: string; logPath?: string | null }) {
  const [log, setLog] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!opts.projectId || !opts.jobId) return;
    setError(null);
    try {
      const text = await getJobLog(opts.projectId, opts.jobId, { tailBytes: 80_000 });
      setLog(text);
    } catch (e: any) {
      setLog("");
      setError(e?.message ?? String(e));
    }
  }, [opts.jobId, opts.projectId]);

  useEffect(() => {
    if (!opts.logPath) {
      setLog("");
      return;
    }
    refresh().catch((e) => setError(e?.message ?? String(e)));
  }, [opts.logPath, refresh]);

  return { log, error, refresh };
}
