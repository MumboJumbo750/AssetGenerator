import { useCallback } from "react";

import { updateAtlasFrames, type AtlasRecord } from "../api";

export function useAtlasPivotSave(opts: {
  selectedAtlas: AtlasRecord | null;
  onRefreshAtlases: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const savePivots = useCallback(async () => {
    if (!opts.selectedAtlas) return;
    try {
      await updateAtlasFrames(opts.selectedAtlas.projectId, opts.selectedAtlas.id, opts.selectedAtlas.frames);
      await opts.onRefreshAtlases();
    } catch (e: any) {
      opts.onError(e?.message ?? String(e));
    }
  }, [opts]);

  return { savePivots };
}
