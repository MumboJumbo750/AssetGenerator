import { useState } from "react";

import { createJob, updateAssetVariant, type Asset } from "../api";
import { useAsyncAction } from "./useAsyncAction";
import { useSelectionSet } from "./useSelectionSet";

export function useAssetBulkActions(opts: {
  projectId: string;
  assets: Asset[];
  selection: ReturnType<typeof useSelectionSet<string>>;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [bulkTagId, setBulkTagId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<"add" | "remove">("add");
  const [bulkCheckpointName, setBulkCheckpointName] = useState("");
  const [bulkWidth, setBulkWidth] = useState(512);
  const [bulkHeight, setBulkHeight] = useState(512);
  const [bulkVariants, setBulkVariants] = useState(4);
  const [bgThreshold, setBgThreshold] = useState<number | null>(null);
  const [bgFeather, setBgFeather] = useState(0);
  const [bgErode, setBgErode] = useState(0);
  const resetBgParams = () => {
    setBgThreshold(null);
    setBgFeather(0);
    setBgErode(0);
  };

  const clearSelection = () => opts.selection.clear();

  const bulkStatusAction = useAsyncAction(
    async (status: "selected" | "rejected") => {
      if (!opts.projectId || opts.selection.count === 0) return;
      for (const asset of opts.assets) {
        if (!opts.selection.has(asset.id)) continue;
        const latest = asset.versions?.[asset.versions.length - 1];
        const primaryId = latest?.primaryVariantId ?? latest?.variants?.[0]?.id ?? "";
        const variant = latest?.variants?.find((v) => v.id === primaryId) ?? latest?.variants?.[0];
        if (!latest || !variant) continue;
        await updateAssetVariant(opts.projectId, asset.id, latest.id, variant.id, { status });
      }
      await opts.onRefresh();
      clearSelection();
    },
    { onError: (message) => opts.onError(message) },
  );

  const bulkTagAction = useAsyncAction(
    async () => {
      if (!opts.projectId || opts.selection.count === 0 || !bulkTagId) return;
      for (const asset of opts.assets) {
        if (!opts.selection.has(asset.id)) continue;
        const latest = asset.versions?.[asset.versions.length - 1];
        const primaryId = latest?.primaryVariantId ?? latest?.variants?.[0]?.id ?? "";
        const variant = latest?.variants?.find((v) => v.id === primaryId) ?? latest?.variants?.[0];
        if (!latest || !variant) continue;
        const current = variant.tags ?? [];
        const next =
          bulkMode === "add"
            ? current.includes(bulkTagId)
              ? current
              : [...current, bulkTagId]
            : current.filter((tag) => tag !== bulkTagId);
        await updateAssetVariant(opts.projectId, asset.id, latest.id, variant.id, { tags: next });
      }
      await opts.onRefresh();
      clearSelection();
    },
    { onError: (message) => opts.onError(message) },
  );

  const bulkRegenerateAction = useAsyncAction(
    async () => {
      if (!opts.projectId || opts.selection.count === 0) return;
      if (!bulkCheckpointName.trim()) {
        opts.onError("Checkpoint name is required for regeneration.");
        return;
      }
      for (const asset of opts.assets) {
        if (!opts.selection.has(asset.id)) continue;
        await createJob(opts.projectId, "generate", {
          specId: asset.specId,
          templateId: "txt2img",
          checkpointName: bulkCheckpointName.trim(),
          width: bulkWidth,
          height: bulkHeight,
          variants: bulkVariants,
        });
      }
      await opts.onRefresh();
      clearSelection();
    },
    { onError: (message) => opts.onError(message) },
  );

  const bulkBgRemoveAction = useAsyncAction(
    async () => {
      if (!opts.projectId || opts.selection.count === 0) return;
      for (const asset of opts.assets) {
        if (!opts.selection.has(asset.id)) continue;
        const approved = asset.versions.filter((v) => v.status === "approved");
        const version = approved.length ? approved[approved.length - 1] : null;
        if (!version) continue;
        const primary = version.primaryVariantId
          ? version.variants.find((v) => v.id === version.primaryVariantId)
          : null;
        const selected = version.variants.find((v) => v.status === "selected") ?? null;
        const candidate = version.variants[0] ?? null;
        const variant = primary ?? selected ?? candidate;
        if (!variant?.originalPath) continue;

        await createJob(opts.projectId, "bg_remove", {
          assetId: asset.id,
          versionId: version.id,
          variantId: variant.id,
          originalPath: variant.originalPath,
          threshold: typeof bgThreshold === "number" ? bgThreshold : undefined,
          feather: bgFeather,
          erode: bgErode,
        });
      }
      await opts.onRefresh();
      clearSelection();
    },
    { onError: (message) => opts.onError(message) },
  );

  const bulkBusy =
    bulkStatusAction.loading || bulkTagAction.loading || bulkRegenerateAction.loading || bulkBgRemoveAction.loading;

  return {
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
  };
}
