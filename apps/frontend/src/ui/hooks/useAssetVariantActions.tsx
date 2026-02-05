import { useCallback, useState } from "react";

import { setPrimaryVariant, updateAssetVariant, updateAssetVersion, type Asset } from "../api";

export function useAssetVariantActions(opts: {
  projectId: string;
  selectedAsset: Asset | null;
  selectedVersion: Asset["versions"][number] | null;
  selectedVariant: Asset["versions"][number]["variants"][number] | null;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [assetUpdateBusy, setAssetUpdateBusy] = useState(false);

  const updateVariant = useCallback(
    async (patch: {
      tags?: string[];
      rating?: number | null;
      status?: "candidate" | "selected" | "rejected";
      reviewNote?: string | null;
    }) => {
      if (!opts.projectId || !opts.selectedAsset || !opts.selectedVersion || !opts.selectedVariant) return;
      setAssetUpdateBusy(true);
      try {
        await updateAssetVariant(
          opts.projectId,
          opts.selectedAsset.id,
          opts.selectedVersion.id,
          opts.selectedVariant.id,
          patch,
        );
        await opts.onRefresh();
      } catch (e: any) {
        opts.onError(e?.message ?? String(e));
      } finally {
        setAssetUpdateBusy(false);
      }
    },
    [opts],
  );

  const onToggleTag = useCallback(
    async (tagId: string, groupTagIds: string[] = [], exclusive = false) => {
      const current = opts.selectedVariant?.tags ?? [];
      const exists = current.includes(tagId);
      let next = exists ? current.filter((t) => t !== tagId) : [...current, tagId];
      if (!exists && exclusive && groupTagIds.length > 0) {
        next = [...next.filter((t) => !groupTagIds.includes(t)), tagId];
      }
      await updateVariant({ tags: next });
    },
    [opts.selectedVariant, updateVariant],
  );

  const onAddCustomTag = useCallback(
    async (customTag: string, onClear: () => void) => {
      const tag = customTag.trim();
      if (!tag) return;
      const current = opts.selectedVariant?.tags ?? [];
      if (!current.includes(tag)) {
        await updateVariant({ tags: [...current, tag] });
      }
      onClear();
    },
    [opts.selectedVariant, updateVariant],
  );

  const onSetVariantStatus = useCallback(
    async (status: "candidate" | "selected" | "rejected") => {
      await updateVariant({ status });
    },
    [updateVariant],
  );

  const onSetVariantRating = useCallback(
    async (value: number | null) => {
      await updateVariant({ rating: value });
    },
    [updateVariant],
  );

  const onSaveReviewNote = useCallback(
    async (reviewNote: string) => {
      if (!opts.selectedVariant) return;
      const note = reviewNote.trim();
      await updateVariant({ reviewNote: note.length === 0 ? null : note });
    },
    [opts.selectedVariant, updateVariant],
  );

  const onSetPrimaryVariant = useCallback(async () => {
    if (!opts.projectId || !opts.selectedAsset || !opts.selectedVersion || !opts.selectedVariant) return;
    setAssetUpdateBusy(true);
    try {
      await setPrimaryVariant(opts.projectId, opts.selectedAsset.id, opts.selectedVersion.id, opts.selectedVariant.id);
      await opts.onRefresh();
    } catch (e: any) {
      opts.onError(e?.message ?? String(e));
    } finally {
      setAssetUpdateBusy(false);
    }
  }, [opts]);

  const onSetVersionStatus = useCallback(
    async (value: "draft" | "review" | "approved" | "rejected" | "deprecated") => {
      if (!opts.projectId || !opts.selectedAsset || !opts.selectedVersion) return;
      setAssetUpdateBusy(true);
      try {
        await updateAssetVersion(opts.projectId, opts.selectedAsset.id, opts.selectedVersion.id, { status: value });
        await opts.onRefresh();
      } catch (e: any) {
        opts.onError(e?.message ?? String(e));
      } finally {
        setAssetUpdateBusy(false);
      }
    },
    [opts],
  );

  const onSetAllVariantsStatus = useCallback(
    async (status: "candidate" | "selected" | "rejected") => {
      if (!opts.projectId || !opts.selectedAsset || !opts.selectedVersion) return;
      const variants = opts.selectedVersion.variants ?? [];
      if (variants.length === 0) return;
      setAssetUpdateBusy(true);
      try {
        for (const variant of variants) {
          await updateAssetVariant(opts.projectId, opts.selectedAsset.id, opts.selectedVersion.id, variant.id, {
            status,
          });
        }
        if (status === "selected" && variants[0]) {
          await setPrimaryVariant(opts.projectId, opts.selectedAsset.id, opts.selectedVersion.id, variants[0].id);
        }
        await opts.onRefresh();
      } catch (e: any) {
        opts.onError(e?.message ?? String(e));
      } finally {
        setAssetUpdateBusy(false);
      }
    },
    [opts],
  );

  return {
    assetUpdateBusy,
    updateVariant,
    onToggleTag,
    onAddCustomTag,
    onSetVariantStatus,
    onSetVariantRating,
    onSaveReviewNote,
    onSetPrimaryVariant,
    onSetVersionStatus,
    onSetAllVariantsStatus,
  };
}
