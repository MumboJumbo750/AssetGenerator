import { useSelectionSet } from "./useSelectionSet";

export function useExportSelections() {
  const assetSelection = useSelectionSet<string>();
  const atlasSelection = useSelectionSet<string>();

  return { assetSelection, atlasSelection };
}
