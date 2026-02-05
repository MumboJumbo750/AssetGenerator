import React, { useEffect, useMemo } from "react";
import { SimpleGrid, Stack } from "@mantine/core";

import { useAppData } from "../context/AppDataContext";
import { useAssetReviewState } from "../hooks/useAssetReviewState";
import { useAssetReviewActions } from "../hooks/useAssetReviewActions";
import { useAssetVariantActions } from "../hooks/useAssetVariantActions";
import { useTextInput } from "../hooks/useTextInput";
import { AssetPreviewPanel } from "./assets/AssetPreviewPanel";
import { AssetReviewPanel } from "./assets/AssetReviewPanel";
import { ReviewListPanel } from "./review/ReviewListPanel";

export function ReviewPage() {
  const {
    selectedProjectId,
    assets,
    specs,
    selectedAssetId,
    setSelectedAssetId,
    tagCatalog,
    tagCatalogError,
    refreshProjectData,
    setError,
  } = useAppData();

  const specsById = useMemo(() => new Map(specs.map((spec) => [spec.id, spec])), [specs]);
  const reviewableAssets = useMemo(() => {
    return assets.filter((asset) => {
      const specOk = specsById.get(asset.specId)?.status !== "deprecated";
      const latest = asset.versions?.[asset.versions.length - 1];
      const versionOk = latest?.status !== "deprecated";
      return specOk && versionOk;
    });
  }, [assets, specsById]);

  useEffect(() => {
    if (!selectedAssetId) {
      if (reviewableAssets[0]) setSelectedAssetId(reviewableAssets[0].id);
      return;
    }
    const spec = reviewableAssets.find((asset) => asset.id === selectedAssetId);
    if (!spec && reviewableAssets[0]) setSelectedAssetId(reviewableAssets[0].id);
  }, [reviewableAssets, selectedAssetId, setSelectedAssetId]);

  const { value: customTag, setValue: setCustomTag } = useTextInput("");
  const {
    selectedAsset,
    sequenceVersions,
    selectedVersion,
    selectedVariant,
    selectedVariantId,
    setSelectedVariantId,
    selectedVersionId,
    setSelectedVersionId,
    reviewNote,
    setReviewNote,
    zoom,
    setZoom,
  } = useAssetReviewState({
    assets: reviewableAssets,
    selectedAssetId,
  });

  const selectedSpec = selectedAsset ? (specsById.get(selectedAsset.specId) ?? null) : null;

  const {
    assetUpdateBusy,
    onToggleTag,
    onAddCustomTag,
    onSetVariantStatus,
    onSetVariantRating,
    onSaveReviewNote,
    onSetPrimaryVariant,
    onSetVersionStatus,
    onSetAllVariantsStatus,
  } = useAssetVariantActions({
    projectId: selectedProjectId,
    selectedAsset: selectedAsset ?? null,
    selectedVersion: selectedVersion ?? null,
    selectedVariant: selectedVariant ?? null,
    onRefresh: refreshProjectData,
    onError: (message) => setError(message),
  });

  const { handleSaveReviewNote, handleAddCustomTag } = useAssetReviewActions({
    reviewNote,
    customTag,
    setCustomTag,
    onSaveReviewNote,
    onAddCustomTag,
  });

  return (
    <Stack gap="lg">
      <ReviewListPanel
        assets={reviewableAssets}
        specsById={specsById}
        selectedAssetId={selectedAssetId}
        onSelectAsset={setSelectedAssetId}
        layout="horizontal"
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <AssetPreviewPanel
          selectedAsset={selectedAsset}
          selectedVersion={selectedVersion}
          selectedVariant={selectedVariant}
          selectedVariantId={selectedVariantId}
          selectedVersionId={selectedVersionId}
          sequenceVersions={sequenceVersions}
          selectedSpec={selectedSpec ?? null}
          projectId={selectedProjectId}
          onRefresh={refreshProjectData}
          zoom={zoom}
          onZoomChange={setZoom}
        />
        <AssetReviewPanel
          selectedAsset={selectedAsset}
          selectedVersion={selectedVersion}
          selectedVariant={selectedVariant}
          selectedVariantId={selectedVariantId}
          selectedSpec={selectedSpec ?? null}
          selectedVersionId={selectedVersionId}
          onSelectVersionId={setSelectedVersionId}
          sequenceVersions={sequenceVersions}
          assetUpdateBusy={assetUpdateBusy}
          reviewNote={reviewNote}
          customTag={customTag}
          zoom={zoom}
          tagCatalog={tagCatalog}
          tagCatalogError={tagCatalogError}
          onSetPrimaryVariant={onSetPrimaryVariant}
          onSetVersionStatus={onSetVersionStatus}
          onSelectVariantId={setSelectedVariantId}
          onSetVariantStatus={onSetVariantStatus}
          onSetVariantRating={onSetVariantRating}
          onSetAllVariantsStatus={onSetAllVariantsStatus}
          onReviewNoteChange={setReviewNote}
          onSaveReviewNote={handleSaveReviewNote}
          onCustomTagChange={setCustomTag}
          onAddCustomTag={handleAddCustomTag}
          onToggleTag={onToggleTag}
          onZoomChange={setZoom}
          showPreview={false}
        />
      </SimpleGrid>
    </Stack>
  );
}
