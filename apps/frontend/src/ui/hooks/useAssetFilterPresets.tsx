import { useCallback } from "react";

export function useAssetFilterPresets(opts: {
  applyFilters: (filters: { searchQuery: string; tagFilter: string | null; assetTypeFilter: string | null; statusFilter: string | null }) => void;
  searchQuery: string;
  tagFilter: string | null;
  assetTypeFilter: string | null;
}) {
  const onPresetNeedsReview = useCallback(() => {
    opts.applyFilters({ searchQuery: opts.searchQuery, tagFilter: opts.tagFilter, assetTypeFilter: opts.assetTypeFilter, statusFilter: "candidate" });
  }, [opts]);

  const onPresetSelected = useCallback(() => {
    opts.applyFilters({ searchQuery: opts.searchQuery, tagFilter: opts.tagFilter, assetTypeFilter: opts.assetTypeFilter, statusFilter: "selected" });
  }, [opts]);

  const onPresetRejected = useCallback(() => {
    opts.applyFilters({ searchQuery: opts.searchQuery, tagFilter: opts.tagFilter, assetTypeFilter: opts.assetTypeFilter, statusFilter: "rejected" });
  }, [opts]);

  return { onPresetNeedsReview, onPresetSelected, onPresetRejected };
}
