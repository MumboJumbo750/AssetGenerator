import { useMemo } from "react";

import type { Asset } from "../api";
import type { AssetListItem } from "../types/viewModels";

export function useAssetDerivedLists(opts: {
  assets: Asset[];
  specById: Map<string, { title: string; assetType: string }>;
  searchQuery: string;
  statusFilter: string | null;
  tagFilter: string | null;
  assetTypeFilter: string | null;
}) {
  const filteredAssets = useMemo(() => {
    const q = opts.searchQuery.trim().toLowerCase();
    return opts.assets.filter((asset) => {
      const latest = asset.versions?.[asset.versions.length - 1];
      const primaryId = latest?.primaryVariantId ?? latest?.variants?.[0]?.id ?? "";
      const representative =
        latest?.variants?.find((variant) => variant.id === primaryId) ?? latest?.variants?.[0] ?? null;
      const tags = representative?.tags ?? [];
      const status = representative?.status ?? "";
      const specInfo = opts.specById.get(asset.specId);
      const assetType = specInfo?.assetType ?? "";
      const title = specInfo?.title ?? "";

      if (opts.assetTypeFilter && assetType !== opts.assetTypeFilter) return false;
      if (opts.statusFilter && status !== opts.statusFilter) return false;
      if (opts.tagFilter && !tags.includes(opts.tagFilter)) return false;

      if (q.length === 0) return true;
      const hay = [asset.id, assetType, title, tags.join(",")].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [opts]);

  const assetList: AssetListItem[] = useMemo(() => {
    return filteredAssets.map((asset) => {
      const latest = asset.versions?.[asset.versions.length - 1];
      const primaryId = latest?.primaryVariantId ?? latest?.variants?.[0]?.id ?? "";
      const variant = latest?.variants?.find((v) => v.id === primaryId) ?? latest?.variants?.[0] ?? null;
      const specInfo = opts.specById.get(asset.specId);
      return {
        id: asset.id,
        specId: asset.specId,
        assetType: specInfo?.assetType ?? null,
        versionsCount: asset.versions.length,
        latestStatus: latest?.status ?? null,
        thumbnailPath: variant?.alphaPath ?? variant?.originalPath ?? null,
      };
    });
  }, [filteredAssets, opts.specById]);

  return { filteredAssets, assetList };
}
