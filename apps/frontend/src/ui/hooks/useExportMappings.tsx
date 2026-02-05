import { useCallback, useEffect, useState } from "react";

import type { AssetSpec } from "../api";

type UiMapping = { type: string; states: Record<string, string> };

export function useExportMappings(uiSpecs: AssetSpec[]) {
  const [animationAtlasMap, setAnimationAtlasMap] = useState<Record<string, string>>({});
  const [uiMappings, setUiMappings] = useState<Record<string, UiMapping>>({});

  useEffect(() => {
    if (uiSpecs.length === 0) return;
    setUiMappings((prev) => {
      const next = { ...prev };
      for (const spec of uiSpecs) {
        if (!next[spec.id]) next[spec.id] = { type: "button", states: {} };
      }
      return next;
    });
  }, [uiSpecs]);

  const updateUiMapping = useCallback((specId: string, mapping: UiMapping) => {
    setUiMappings((prev) => ({ ...prev, [specId]: mapping }));
  }, []);

  const resetMappings = useCallback(() => {
    setAnimationAtlasMap({});
    setUiMappings({});
  }, []);

  return {
    animationAtlasMap,
    setAnimationAtlasMap,
    uiMappings,
    setUiMappings,
    updateUiMapping,
    resetMappings,
  };
}
