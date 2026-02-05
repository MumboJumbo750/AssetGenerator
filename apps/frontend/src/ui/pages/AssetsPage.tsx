import React from "react";
import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { type Asset } from "../api";
import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";
import { useAssetBulkActions } from "../hooks/useAssetBulkActions";
import { useAssetReviewState } from "../hooks/useAssetReviewState";
import { useAssetReviewActions } from "../hooks/useAssetReviewActions";
import { useAssetVariantActions } from "../hooks/useAssetVariantActions";
import { useAssetsViewModel } from "../hooks/useAssetsViewModel";
import { useTextInput } from "../hooks/useTextInput";
import { AssetFiltersPanel } from "./assets/AssetFiltersPanel";
import { AssetListPanel } from "./assets/AssetListPanel";
import { AssetReviewPanel } from "./assets/AssetReviewPanel";
import { BulkActionsPanel } from "./assets/BulkActionsPanel";

export function AssetsPage() {
  const {
    selectedProjectId,
    assets,
    selectedAssetId,
    setSelectedAssetId,
    specs,
    tagCatalog,
    tagCatalogError,
    refreshProjectData,
    setError,
  } = useAppData();

  const { value: customTag, setValue: setCustomTag } = useTextInput("");
  const {
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
    onPresetNeedsReview,
    onPresetSelected,
    onPresetRejected,
    assetTypeOptions,
    tagOptions,
    filteredAssets,
    assetList,
    assetsCount,
    filteredCount,
    selection,
    selectAllFiltered,
    clearSelection,
  } = useAssetsViewModel({
    assets,
    specs,
    tagCatalog,
  });
  const {
    bulkTagId,
    bulkMode,
    bulkCheckpointName,
    bulkWidth,
    bulkHeight,
    bulkVariants,
    bgThreshold,
    bgFeather,
    bgErode,
    setBulkTagId,
    setBulkMode,
    setBulkCheckpointName,
    setBulkWidth,
    setBulkHeight,
    setBulkVariants,
    setBgThreshold,
    setBgFeather,
    setBgErode,
    resetBgParams,
    bulkStatusAction,
    bulkTagAction,
    bulkRegenerateAction,
    bulkBgRemoveAction,
    bulkBusy,
  } = useAssetBulkActions({
    projectId: selectedProjectId,
    assets: filteredAssets,
    selection,
    onRefresh: refreshProjectData,
    onError: (message) => setError(message),
  });

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
    assets,
    selectedAssetId,
  });

  const selectedSpec = selectedAsset ? (specs.find((spec) => spec.id === selectedAsset.specId) ?? null) : null;

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
    selectedAsset: selectedAsset as Asset | null,
    selectedVersion: selectedVersion as Asset["versions"][number] | null,
    selectedVariant: selectedVariant as Asset["versions"][number]["variants"][number] | null,
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
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Assets</Title>
          <HelpTip label="Review and tag variants before export or training." topicId="review-variants" />
        </Group>
        <Text c="dimmed">Review + tagging</Text>
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Stack gap="md">
          <AssetFiltersPanel
            assetsCount={assetsCount}
            filteredCount={filteredCount}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            tagFilter={tagFilter}
            assetTypeFilter={assetTypeFilter}
            assetTypeOptions={assetTypeOptions}
            tagOptions={tagOptions}
            savedFilters={savedFilters}
            savedFilterName={savedFilterName}
            onSearchChange={setSearchQuery}
            onStatusChange={setStatusFilter}
            onTagChange={setTagFilter}
            onAssetTypeChange={setAssetTypeFilter}
            onClearFilters={clearFilters}
            onPresetNeedsReview={onPresetNeedsReview}
            onPresetSelected={onPresetSelected}
            onPresetRejected={onPresetRejected}
            onSavedFilterNameChange={setSavedFilterName}
            onSaveFilter={saveCurrentFilter}
            onApplyFilter={applyFilters}
            onRemoveFilter={removeSavedFilter}
          />
          <BulkActionsPanel
            selectionCount={selection.count}
            bulkBusy={bulkBusy}
            tagOptions={tagOptions}
            bulkTagId={bulkTagId}
            bulkMode={bulkMode}
            bulkCheckpointName={bulkCheckpointName}
            bulkWidth={bulkWidth}
            bulkHeight={bulkHeight}
            bulkVariants={bulkVariants}
            bgThreshold={bgThreshold}
            bgFeather={bgFeather}
            bgErode={bgErode}
            onSelectAll={selectAllFiltered}
            onClearSelection={clearSelection}
            onApproveSelected={() => bulkStatusAction.run("selected")}
            onRejectSelected={() => bulkStatusAction.run("rejected")}
            onBulkTagIdChange={setBulkTagId}
            onBulkModeChange={setBulkMode}
            onApplyTag={() => bulkTagAction.run()}
            onCheckpointNameChange={setBulkCheckpointName}
            onWidthChange={setBulkWidth}
            onHeightChange={setBulkHeight}
            onVariantsChange={setBulkVariants}
            onRegenerate={() => bulkRegenerateAction.run()}
            onBgThresholdChange={setBgThreshold}
            onBgFeatherChange={setBgFeather}
            onBgErodeChange={setBgErode}
            onRunBgRemove={() => bulkBgRemoveAction.run()}
            onResetBgParams={resetBgParams}
            disableSelectAll={filteredAssets.length === 0}
          />
          <AssetListPanel
            assets={assetList}
            assetsTotal={assetsCount}
            filteredTotal={filteredCount}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            isSelected={selection.has}
            onToggleSelection={selection.toggle}
            onClearFilters={clearFilters}
          />
        </Stack>

        <AssetReviewPanel
          selectedAsset={selectedAsset}
          selectedVersion={selectedVersion}
          selectedVariant={selectedVariant}
          selectedVariantId={selectedVariantId}
          selectedSpec={selectedSpec}
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
        />
      </SimpleGrid>
    </Stack>
  );
}
