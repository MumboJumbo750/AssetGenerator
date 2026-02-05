import { useCallback, useEffect, useMemo, useState } from "react";

import type { AssetFilters } from "../types/viewModels";

const STORAGE_KEY = "assetFilters";

export function useAssetFilters(initial: AssetFilters) {
  const [searchQuery, setSearchQuery] = useState<AssetFilters["searchQuery"]>(initial.searchQuery);
  const [statusFilter, setStatusFilter] = useState<AssetFilters["statusFilter"]>(initial.statusFilter);
  const [tagFilter, setTagFilter] = useState<AssetFilters["tagFilter"]>(initial.tagFilter);
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetFilters["assetTypeFilter"]>(initial.assetTypeFilter);
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string } & AssetFilters>>([]);
  const [savedFilterName, setSavedFilterName] = useState("");

  const filters = useMemo<AssetFilters>(
    () => ({
      searchQuery,
      statusFilter,
      tagFilter,
      assetTypeFilter,
    }),
    [assetTypeFilter, searchQuery, statusFilter, tagFilter],
  );

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter(null);
    setTagFilter(null);
    setAssetTypeFilter(null);
  }, []);

  const applyFilters = useCallback((next: AssetFilters) => {
    setSearchQuery(next.searchQuery);
    setStatusFilter(next.statusFilter);
    setTagFilter(next.tagFilter);
    setAssetTypeFilter(next.assetTypeFilter);
  }, []);

  const saveCurrentFilter = useCallback(() => {
    const name = savedFilterName.trim();
    if (!name) return;
    const next = [
      ...savedFilters.filter((f) => f.name !== name),
      { name, searchQuery, statusFilter, tagFilter, assetTypeFilter },
    ];
    setSavedFilters(next);
    setSavedFilterName("");
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [assetTypeFilter, savedFilterName, savedFilters, searchQuery, statusFilter, tagFilter]);

  const removeSavedFilter = useCallback(
    (name: string) => {
      const next = savedFilters.filter((f) => f.name !== name);
      setSavedFilters(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [savedFilters],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{ name: string } & AssetFilters>;
      if (Array.isArray(parsed)) setSavedFilters(parsed);
    } catch {
      // ignore
    }
  }, []);

  return {
    filters,
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
  };
}
