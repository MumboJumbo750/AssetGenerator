import { useCallback } from "react";

import type { Asset } from "../api";
import { useSelectionSet } from "./useSelectionSet";

export function useAssetSelectionHelpers(opts: {
  selection: ReturnType<typeof useSelectionSet<string>>;
  filteredAssets: Asset[];
}) {
  const selectAllFiltered = useCallback(() => {
    opts.selection.select(opts.filteredAssets.map((asset) => asset.id));
  }, [opts]);

  const clearSelection = useCallback(() => {
    opts.selection.clear();
  }, [opts]);

  return { selectAllFiltered, clearSelection };
}
