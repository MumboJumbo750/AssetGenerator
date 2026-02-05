import { useMemo } from "react";

import type { Asset, AssetSpec, AtlasRecord } from "../api";

type ExportableAsset = {
  id: string;
  specId: string;
  title: string;
  previewPath: string;
  tags: string[];
};

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "asset"
  );
}

function buildNameMap(assetIds: string[], opts: { prefix?: string; suffix?: string }) {
  const used = new Map<string, number>();
  const names = new Map<string, string>();
  for (const assetId of assetIds) {
    const key = slugify(`${opts.prefix ?? ""}${assetId}${opts.suffix ?? ""}`);
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    names.set(assetId, count === 0 ? key : `${key}_${count + 1}`);
  }
  return names;
}

export function useExportsViewModel(opts: {
  assets: Asset[];
  specs: AssetSpec[];
  uiSpecs?: AssetSpec[];
  atlases: AtlasRecord[];
  assetSelection: Set<string>;
  atlasSelection: Set<string>;
  animationAtlasMap: Record<string, string>;
  uiMappings: Record<string, { type?: string; states?: Record<string, string> }>;
  profilePrefix: string;
  profileSuffix: string;
}) {
  const uiSpecs = useMemo(
    () =>
      opts.uiSpecs ??
      opts.specs.filter((spec) => spec.output?.kind === "ui_states" && spec.output?.uiStates?.states?.length),
    [opts.specs, opts.uiSpecs],
  );

  const animationSpecs = useMemo(
    () => opts.specs.filter((spec) => spec.output?.kind === "animation" && spec.output?.animation?.frameNames?.length),
    [opts.specs],
  );

  const specTitleById = useMemo(() => new Map(opts.specs.map((spec) => [spec.id, spec.title])), [opts.specs]);

  const exportableAssets = useMemo<ExportableAsset[]>(() => {
    return opts.assets
      .map((asset) => {
        const approvedVersions = asset.versions.filter((v) => v.status === "approved");
        const version = approvedVersions.length ? approvedVersions[approvedVersions.length - 1] : null;
        if (!version) return null;
        const primary = version.primaryVariantId
          ? version.variants.find((v) => v.id === version.primaryVariantId)
          : null;
        const selected = version.variants.find((v) => v.status === "selected") ?? null;
        const candidate = version.variants[0] ?? null;
        const variant = primary ?? selected ?? candidate;
        if (!variant) return null;
        const previewPath = variant.alphaPath ?? variant.originalPath;
        const title = specTitleById.get(asset.specId) ?? asset.specId;
        return { id: asset.id, specId: asset.specId, title, previewPath, tags: variant.tags ?? [] };
      })
      .filter(Boolean) as ExportableAsset[];
  }, [opts.assets, specTitleById]);

  const exportNameMap = useMemo(() => {
    const assetIds = Array.from(opts.assetSelection);
    return buildNameMap(assetIds, { prefix: opts.profilePrefix, suffix: opts.profileSuffix });
  }, [opts.assetSelection, opts.profilePrefix, opts.profileSuffix]);

  const imageOptions = useMemo(
    () =>
      Array.from(exportNameMap.entries()).map(([assetId, name]) => ({
        value: name,
        label: `Image: ${name} (${assetId})`,
      })),
    [exportNameMap],
  );

  const atlasFrameOptions = useMemo(() => {
    const selectedAtlasIds = new Set(Array.from(opts.atlasSelection));
    const options: Array<{ value: string; label: string }> = [];
    for (const atlas of opts.atlases) {
      if (selectedAtlasIds.size > 0 && !selectedAtlasIds.has(atlas.id)) continue;
      for (const frame of atlas.frames) {
        options.push({ value: frame.id, label: `Atlas ${atlas.id}: ${frame.id}` });
      }
    }
    return options;
  }, [opts.atlases, opts.atlasSelection]);

  const textureOptions = useMemo(() => [...imageOptions, ...atlasFrameOptions], [imageOptions, atlasFrameOptions]);

  const missingAnimationMappings = useMemo(
    () => animationSpecs.filter((spec) => !opts.animationAtlasMap[spec.id]),
    [animationSpecs, opts.animationAtlasMap],
  );

  const missingUiMappings = useMemo(
    () =>
      uiSpecs
        .map((spec) => {
          const states = spec.output?.uiStates?.states ?? [];
          const mapping = opts.uiMappings[spec.id]?.states ?? {};
          const missing = states.filter((state) => !mapping[state]);
          if (missing.length === 0) return null;
          return { spec, missing };
        })
        .filter(Boolean) as Array<{ spec: (typeof uiSpecs)[number]; missing: string[] }>,
    [uiSpecs, opts.uiMappings],
  );

  return {
    uiSpecs,
    animationSpecs,
    specTitleById,
    exportableAssets,
    exportNameMap,
    imageOptions,
    atlasFrameOptions,
    textureOptions,
    missingAnimationMappings,
    missingUiMappings,
  };
}
