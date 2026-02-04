import { useEffect, useMemo, useState } from "react";

import type { Asset } from "../api";

export function useAssetReviewState(opts: {
  assets: Asset[];
  selectedAssetId: string | null;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [zoom, setZoom] = useState(1);

  const selectedAsset = useMemo(
    () => (opts.selectedAssetId ? opts.assets.find((asset) => asset.id === opts.selectedAssetId) ?? null : null),
    [opts.selectedAssetId, opts.assets]
  );

  const selectedVersion = selectedAsset?.versions?.[selectedAsset.versions.length - 1] ?? null;
  const selectedVariant =
    selectedVersion && selectedVariantId
      ? selectedVersion.variants.find((variant) => variant.id === selectedVariantId) ?? null
      : selectedVersion?.variants?.[0] ?? null;

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedVariantId("");
      setZoom(1);
      setReviewNote("");
      return;
    }
    const latest = selectedAsset.versions?.[selectedAsset.versions.length - 1];
    const preferred = latest?.primaryVariantId ?? latest?.variants?.[0]?.id ?? "";
    setSelectedVariantId(preferred);
    setZoom(1);
  }, [opts.selectedAssetId, opts.assets]);

  useEffect(() => {
    setReviewNote(selectedVariant?.reviewNote ?? "");
  }, [selectedVariant?.id]);

  return {
    selectedAsset,
    selectedVersion,
    selectedVariant,
    selectedVariantId,
    setSelectedVariantId,
    reviewNote,
    setReviewNote,
    zoom,
    setZoom
  };
}
