import { useCallback } from "react";

import { createJob, type AssetSpec, type ExportProfile } from "../api";
import { useSelectionSet } from "./useSelectionSet";

export function useExportRun(opts: {
  projectId: string;
  exportId: string;
  setExportId: (value: string) => void;
  selectedProfile: ExportProfile | null;
  assetSelection: ReturnType<typeof useSelectionSet<string>>;
  atlasSelection: ReturnType<typeof useSelectionSet<string>>;
  animationSpecs: AssetSpec[];
  animationAtlasMap: Record<string, string>;
  uiSpecs: AssetSpec[];
  uiMappings: Record<string, { type?: string; states?: Record<string, string> }>;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const runExport = useCallback(async () => {
    if (!opts.projectId) return;
    const assetIds = Array.from(opts.assetSelection.selected);
    const atlasIds = Array.from(opts.atlasSelection.selected);
    if (assetIds.length === 0 && atlasIds.length === 0) {
      opts.onError("Select assets or atlases to export.");
      return;
    }

    const animations = opts.animationSpecs
      .map((spec) => {
        const atlasId = opts.animationAtlasMap[spec.id];
        if (!atlasId) return null;
        const animation = spec.output?.animation;
        const frames = animation?.frameNames ?? [];
        if (frames.length === 0) return null;
        return {
          name: animation?.name ?? spec.title,
          assetId: spec.id,
          atlasId,
          frames,
          fps: animation?.fps ?? 12,
          loop: animation?.loop ?? true,
        };
      })
      .filter(Boolean) as Array<{
      name: string;
      assetId: string;
      atlasId: string;
      frames: string[];
      fps: number;
      loop: boolean;
    }>;

    const requiredAtlasIds = new Set(animations.map((a) => a.atlasId));
    const atlasIdsFinal = Array.from(new Set([...atlasIds, ...requiredAtlasIds]));

    const ui = opts.uiSpecs
      .map((spec) => {
        const mapping = opts.uiMappings[spec.id];
        if (!mapping) return null;
        const states = spec.output?.uiStates?.states ?? [];
        const stateMap: Record<string, string> = {};
        for (const state of states) {
          const value = mapping.states?.[state];
          if (value) stateMap[state] = value;
        }
        if (Object.keys(stateMap).length === 0) return null;
        return { name: spec.title, type: mapping.type ?? "button", states: stateMap };
      })
      .filter(Boolean) as Array<{ name: string; type: string; states: Record<string, string> }>;

    try {
      await createJob(opts.projectId, "export", {
        exportId: opts.exportId.trim() || undefined,
        assetIds,
        atlasIds: atlasIdsFinal,
        profileId: opts.selectedProfile?.id,
        profileSnapshot: opts.selectedProfile
          ? {
              id: opts.selectedProfile.id,
              name: opts.selectedProfile.name,
              type: opts.selectedProfile.type,
              options: opts.selectedProfile.options,
            }
          : undefined,
        animations,
        ui,
      });
      await opts.onRefresh();
      opts.setExportId("");
    } catch (e: any) {
      opts.onError(e?.message ?? String(e));
    }
  }, [opts]);

  return { runExport };
}
