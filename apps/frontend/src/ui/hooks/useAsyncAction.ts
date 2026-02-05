import { useCallback, useState } from "react";

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  opts?: { onError?: (error: string) => void },
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs) => {
      setLoading(true);
      setError(null);
      try {
        return await action(...args);
      } catch (e: any) {
        const message = e?.message ?? String(e);
        setError(message);
        opts?.onError?.(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [action, opts],
  );

  return { run, loading, error, setError };
}
