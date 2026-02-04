import { useCallback, useEffect, useState } from "react";

import { getSystemLog } from "../api";

export function useSystemLog(service: "backend" | "worker") {
  const [log, setLog] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const text = await getSystemLog(service, { tailBytes: 80_000 });
      setLog(text);
    } catch (e: any) {
      setLog("");
      setError(e?.message ?? String(e));
    }
  }, [service]);

  useEffect(() => {
    refresh().catch((e) => setError(e?.message ?? String(e)));
  }, [refresh]);

  return { log, error, refresh };
}
