import { useMemo } from "react";

import type { AssetSpec, TagCatalog } from "../api";
import type { TagOption } from "../types/viewModels";

export function useAssetCatalogOptions(specs: AssetSpec[], tagCatalog: TagCatalog | null) {
  const specById = useMemo(() => {
    const map = new Map<string, { title: string; assetType: string }>();
    for (const spec of specs) {
      map.set(spec.id, { title: spec.title, assetType: spec.assetType });
    }
    return map;
  }, [specs]);

  const assetTypeOptions: TagOption[] = useMemo(() => {
    const types = new Set<string>();
    for (const spec of specs) types.add(spec.assetType);
    return Array.from(types).sort().map((value) => ({ value, label: value }));
  }, [specs]);

  const tagOptions: TagOption[] = useMemo(() => {
    if (!tagCatalog) return [];
    return tagCatalog.groups.flatMap((group) =>
      group.tags.map((tag) => ({
        value: tag.id,
        label: `${group.label}: ${tag.label}`
      }))
    );
  }, [tagCatalog]);

  return { specById, assetTypeOptions, tagOptions };
}
