import { useMemo } from "react";

import type { Asset, AssetSpec, TagCatalog } from "../api";
import { useAssetCatalogOptions } from "./useAssetCatalogOptions";
import { useAssetDerivedLists } from "./useAssetDerivedLists";
import { useAssetFilterPresets } from "./useAssetFilterPresets";
import { useAssetFilters } from "./useAssetFilters";
import { useAssetSelectionHelpers } from "./useAssetSelectionHelpers";
import { useSelectionSet } from "./useSelectionSet";

export function useAssetsViewModel(opts: {
  assets: Asset[];
  specs: AssetSpec[];
  tagCatalog: TagCatalog | null;
}) {
  const {
    searchQuery,
    statusFilter,
    tagFilter,
    assetTypeFilter,
    savedFilters,
    savedFilterName,
    setSearchQuery,
    setStatusFilter,
    setTagFilter,
    setAssetTypeFilter,
    setSavedFilterName,
    clearFilters,
    applyFilters,
    saveCurrentFilter,
    removeSavedFilter
  } = useAssetFilters({ searchQuery: "", statusFilter: null, tagFilter: null, assetTypeFilter: null });

  const { specById, assetTypeOptions, tagOptions } = useAssetCatalogOptions(opts.specs, opts.tagCatalog);

  const { filteredAssets, assetList } = useAssetDerivedLists({
    assets: opts.assets,
    specById,
    searchQuery,
    statusFilter,
    tagFilter,
    assetTypeFilter
  });

  const selection = useSelectionSet<string>();
  const { selectAllFiltered, clearSelection } = useAssetSelectionHelpers({
    selection,
    filteredAssets
  });

  const { onPresetNeedsReview, onPresetSelected, onPresetRejected } = useAssetFilterPresets({
    applyFilters,
    searchQuery,
    tagFilter,
    assetTypeFilter
  });

  const assetsCount = opts.assets.length;
  const filteredCount = filteredAssets.length;

  return {
    searchQuery,
    statusFilter,
    tagFilter,
    assetTypeFilter,
    savedFilters,
    savedFilterName,
    setSearchQuery,
    setStatusFilter,
    setTagFilter,
    setAssetTypeFilter,
    setSavedFilterName,
    clearFilters,
    applyFilters,
    saveCurrentFilter,
    removeSavedFilter,
    onPresetNeedsReview,
    onPresetSelected,
    onPresetRejected,
    specById,
    assetTypeOptions,
    tagOptions,
    filteredAssets,
    assetList,
    assetsCount,
    filteredCount,
    selection,
    selectAllFiltered,
    clearSelection
  };
}
