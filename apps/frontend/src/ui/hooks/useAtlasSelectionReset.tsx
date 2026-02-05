import { useEffect } from "react";

export function useAtlasSelectionReset(opts: { selectedAtlasId: string | null; onReset: () => void }) {
  useEffect(() => {
    opts.onReset();
  }, [opts.selectedAtlasId, opts.onReset]);
}
