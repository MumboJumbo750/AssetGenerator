import { useEffect } from "react";

import { useSelectionSet } from "./useSelectionSet";

export function useExportSelectionReset(opts: {
  projectId: string;
  assetSelection: ReturnType<typeof useSelectionSet<string>>;
  atlasSelection: ReturnType<typeof useSelectionSet<string>>;
  resetMappings: () => void;
}) {
  useEffect(() => {
    if (!opts.projectId) return;
    opts.assetSelection.clear();
    opts.atlasSelection.clear();
    opts.resetMappings();
  }, [opts.projectId, opts.assetSelection, opts.atlasSelection, opts.resetMappings]);
}
