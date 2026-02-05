import { useEffect, useMemo, useState } from "react";

import type { Asset } from "../api";

export function useAssetReviewState(opts: { assets: Asset[]; selectedAssetId: string | null }) {
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [variantByVersionId, setVariantByVersionId] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [zoom, setZoom] = useState(1);

  const selectedAsset = useMemo(
    () => (opts.selectedAssetId ? (opts.assets.find((asset) => asset.id === opts.selectedAssetId) ?? null) : null),
    [opts.selectedAssetId, opts.assets],
  );

  const sequenceVersions = useMemo(() => {
    if (!selectedAsset) return [];
    const versions = [...(selectedAsset.versions ?? [])];
    const hasFrames = versions.some((version) => Number.isFinite(Number((version as any).generation?.frameIndex)));
    if (hasFrames) {
      versions.sort((a, b) => {
        const aIndex = Number((a as any).generation?.frameIndex);
        const bIndex = Number((b as any).generation?.frameIndex);
        const aHas = Number.isFinite(aIndex);
        const bHas = Number.isFinite(bIndex);
        if (aHas && bHas && aIndex !== bIndex) return aIndex - bIndex;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
    }
    return versions;
  }, [selectedAsset]);

  const defaultVersion = useMemo(() => {
    if (!selectedAsset || sequenceVersions.length === 0) return null;
    const hasFrames = sequenceVersions.some((version) =>
      Number.isFinite(Number((version as any).generation?.frameIndex)),
    );
    return hasFrames ? sequenceVersions[0] : sequenceVersions[sequenceVersions.length - 1];
  }, [selectedAsset, sequenceVersions]);

  const selectedVersion = selectedAsset
    ? (sequenceVersions.find((version) => version.id === selectedVersionId) ?? defaultVersion ?? null)
    : null;
  const selectedVariant =
    selectedVersion && selectedVariantId
      ? (selectedVersion.variants.find((variant) => variant.id === selectedVariantId) ?? null)
      : (selectedVersion?.variants?.[0] ?? null);

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedVariantId("");
      setSelectedVersionId("");
      setVariantByVersionId({});
      setZoom(1);
      setReviewNote("");
      return;
    }
    const versionIds = new Set(sequenceVersions.map((version) => version.id));
    const hasSelection = selectedVersionId && versionIds.has(selectedVersionId);
    if (hasSelection) return;
    const preferredVersion = defaultVersion ?? selectedAsset.versions?.[selectedAsset.versions.length - 1];
    if (preferredVersion?.id) setSelectedVersionId(preferredVersion.id);
    const preferred = preferredVersion?.primaryVariantId ?? preferredVersion?.variants?.[0]?.id ?? "";
    setSelectedVariantId(preferred);
    setZoom(1);
  }, [selectedAsset?.id, sequenceVersions, selectedVersionId]);

  useEffect(() => {
    if (!selectedVersion) {
      setSelectedVariantId("");
      return;
    }
    const saved = variantByVersionId[selectedVersion.id];
    const preferred = saved ?? selectedVersion.primaryVariantId ?? selectedVersion.variants?.[0]?.id ?? "";
    if (preferred && preferred !== selectedVariantId) {
      setSelectedVariantId(preferred);
    }
  }, [
    selectedVersion?.id,
    selectedVersion?.primaryVariantId,
    selectedVersion?.variants,
    variantByVersionId,
    selectedVariantId,
  ]);

  useEffect(() => {
    setReviewNote(selectedVariant?.reviewNote ?? "");
  }, [selectedVariant?.id]);

  const selectVariantId = (value: string) => {
    setSelectedVariantId(value);
    if (selectedVersionId) {
      setVariantByVersionId((prev) => ({ ...prev, [selectedVersionId]: value }));
    }
  };

  return {
    selectedAsset,
    sequenceVersions,
    selectedVersion,
    selectedVariant,
    selectedVariantId,
    setSelectedVariantId: selectVariantId,
    selectedVersionId,
    setSelectedVersionId,
    reviewNote,
    setReviewNote,
    zoom,
    setZoom,
  };
}
