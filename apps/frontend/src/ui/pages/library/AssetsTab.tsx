import React, { useMemo } from "react";

import type { Asset, AssetSpec } from "../../api";
import { ImageGrid, type ImageGridItem } from "../../components/ImageGrid";

type AssetsTabProps = {
  assets: Asset[];
  specs: AssetSpec[];
  query: string;
  status: string;
  assetType: string;
  stage: string;
  loraMode: string;
  styleConsistency: string;
  backgroundPolicy: string;
  exportedSpecIds: Set<string>;
  onSelectItem: (itemId: string) => void;
};

function resolveAssetStage(
  outputKind: string | undefined,
  latestStatus?: string,
  hasAlpha?: boolean,
  hasExport?: boolean,
) {
  if (hasExport) return "exported";
  if (!latestStatus) return "draft";
  if (latestStatus === "approved") {
    if (outputKind === "animation") return hasAlpha ? "atlas" : "alpha";
    return "alpha";
  }
  return "review";
}

export function AssetsTab({
  assets,
  specs,
  query,
  status,
  assetType,
  stage,
  loraMode,
  styleConsistency,
  backgroundPolicy,
  exportedSpecIds,
  onSelectItem,
}: AssetsTabProps) {
  const specsById = useMemo(() => new Map(specs.map((spec) => [spec.id, spec])), [specs]);

  const items = useMemo<ImageGridItem[]>(() => {
    return assets
      .map((asset) => {
        const latestVersion = asset.versions[asset.versions.length - 1];
        const selectedVariant =
          latestVersion?.variants.find((variant) => variant.id === latestVersion.primaryVariantId) ??
          latestVersion?.variants[0];
        const spec = specsById.get(asset.specId);
        const firstLora = Array.isArray((latestVersion as any)?.generation?.loras)
          ? (latestVersion as any).generation.loras[0]
          : null;
        const loraBadge =
          firstLora && (firstLora.loraId || firstLora.releaseId)
            ? `LoRA:${String(firstLora.loraId ?? "manual")}:${String(firstLora.releaseId ?? "n/a")}`
            : undefined;
        const loraModeBadge = `policy:${spec?.loraPolicy?.mode ?? "project-default"}`;
        const styleConsistencyBadge = `style:${spec?.styleConsistency?.mode ?? "inherit_project"}`;
        const backgroundPolicyBadge = `quality:${spec?.qualityContract?.backgroundPolicy ?? "white_or_transparent"}`;
        const baselineBadge = `baseline:${spec?.baselineProfileId ?? "default"}`;
        const stageValue = resolveAssetStage(
          spec?.output?.kind,
          latestVersion?.status,
          Boolean(selectedVariant?.alphaPath),
          exportedSpecIds.has(asset.specId),
        );
        return {
          id: asset.id,
          title: spec?.title ?? asset.id,
          subtitle: asset.id,
          imagePath: selectedVariant?.previewPath ?? selectedVariant?.alphaPath ?? selectedVariant?.originalPath,
          badges: [
            spec?.assetType ?? "unknown",
            latestVersion?.status ?? "unknown",
            stageValue,
            baselineBadge,
            loraModeBadge,
            styleConsistencyBadge,
            backgroundPolicyBadge,
            ...(loraBadge ? [loraBadge] : []),
          ],
          meta: `${latestVersion?.variants.length ?? 0} vars`,
        };
      })
      .filter((item) => {
        const q = query.trim().toLowerCase();
        const matchesQuery = !q || item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
        const matchesStatus = status === "all" || item.badges?.[1] === status;
        const matchesType = assetType === "all" || item.badges?.[0] === assetType;
        const matchesStage = stage === "all" || item.badges?.[2] === stage;
        const matchesLoraMode =
          loraMode === "all" ||
          item.badges?.includes(`policy:${loraMode}`) ||
          (loraMode === "project-default" && !item.badges?.some((badge) => badge.startsWith("policy:")));
        const matchesStyleConsistency =
          styleConsistency === "all" || item.badges?.includes(`style:${styleConsistency}`);
        const matchesBackgroundPolicy =
          backgroundPolicy === "all" || item.badges?.includes(`quality:${backgroundPolicy}`);
        return (
          matchesQuery &&
          matchesStatus &&
          matchesType &&
          matchesStage &&
          matchesLoraMode &&
          matchesStyleConsistency &&
          matchesBackgroundPolicy
        );
      });
  }, [
    assetType,
    assets,
    backgroundPolicy,
    exportedSpecIds,
    loraMode,
    query,
    specsById,
    stage,
    status,
    styleConsistency,
  ]);

  return <ImageGrid items={items} onSelect={onSelectItem} />;
}
