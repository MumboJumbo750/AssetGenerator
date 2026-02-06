import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type LibraryTab = "assets" | "atlases" | "loras" | "exports";

export type FilterState = {
  tab: LibraryTab;
  q: string;
  status: string;
  assetType: string;
  stage: string;
  loraMode: string;
  styleConsistency: string;
  backgroundPolicy: string;
  selected: string;
};

const DEFAULT_STATE: FilterState = {
  tab: "assets",
  q: "",
  status: "all",
  assetType: "all",
  stage: "all",
  loraMode: "all",
  styleConsistency: "all",
  backgroundPolicy: "all",
  selected: "",
};

export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<FilterState>(() => {
    const tabRaw = searchParams.get("tab");
    const tab: LibraryTab = tabRaw === "atlases" || tabRaw === "loras" || tabRaw === "exports" ? tabRaw : "assets";
    return {
      tab,
      q: searchParams.get("q") ?? DEFAULT_STATE.q,
      status: searchParams.get("status") ?? DEFAULT_STATE.status,
      assetType: searchParams.get("assetType") ?? DEFAULT_STATE.assetType,
      stage: searchParams.get("stage") ?? DEFAULT_STATE.stage,
      loraMode: searchParams.get("loraMode") ?? DEFAULT_STATE.loraMode,
      styleConsistency: searchParams.get("styleConsistency") ?? DEFAULT_STATE.styleConsistency,
      backgroundPolicy: searchParams.get("backgroundPolicy") ?? DEFAULT_STATE.backgroundPolicy,
      selected: searchParams.get("selected") ?? DEFAULT_STATE.selected,
    };
  }, [searchParams]);

  const setParam = useCallback(
    (key: keyof FilterState, value: string) => {
      const next = new URLSearchParams(searchParams);
      const defaultValue = DEFAULT_STATE[key] as string;
      if (!value || value === defaultValue) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setTab = useCallback((value: LibraryTab) => setParam("tab", value), [setParam]);

  return {
    state,
    setTab,
    setQuery: (value: string) => setParam("q", value),
    setStatus: (value: string) => setParam("status", value),
    setAssetType: (value: string) => setParam("assetType", value),
    setStage: (value: string) => setParam("stage", value),
    setLoraMode: (value: string) => setParam("loraMode", value),
    setStyleConsistency: (value: string) => setParam("styleConsistency", value),
    setBackgroundPolicy: (value: string) => setParam("backgroundPolicy", value),
    setSelected: (value: string) => setParam("selected", value),
  };
}
