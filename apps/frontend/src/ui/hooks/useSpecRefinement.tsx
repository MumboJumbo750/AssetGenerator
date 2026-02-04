import { useCallback, useMemo, useState } from "react";

import { createSpec, updateSpecList, type AssetSpec, type SpecList } from "../api";

type RefineItem = { title: string; assetType: string };

export function useSpecRefinement(opts: {
  projectId: string;
  assetTypeOptions: string[];
  selectedSpecList: SpecList | null;
  onError: (message: string) => void;
}) {
  const [refineDefaultType, setRefineDefaultType] = useState("ui_icon");
  const [refineItems, setRefineItems] = useState<RefineItem[]>([]);
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const parseSpecListText = useCallback(
    (text: string, fallbackAssetType: string) => {
      const lines = text.split(/\r?\n/);
      const items: RefineItem[] = [];
      for (const raw of lines) {
        const cleaned = raw.replace(/^[-*•\s]+/, "").trim();
        if (!cleaned) continue;
        const match = cleaned.match(/^([a-z0-9_:-]+)\s*:\s*(.+)$/i);
        if (match && opts.assetTypeOptions.includes(match[1])) {
          items.push({ assetType: match[1], title: match[2].trim() });
        } else {
          items.push({ assetType: fallbackAssetType, title: cleaned });
        }
      }
      return items;
    },
    [opts.assetTypeOptions]
  );

  const onParseSpecList = useCallback(() => {
    setRefineError(null);
    if (!opts.selectedSpecList) {
      setRefineItems([]);
      return;
    }
    const items = parseSpecListText(opts.selectedSpecList.text ?? "", refineDefaultType);
    setRefineItems(items);
  }, [opts.selectedSpecList, parseSpecListText, refineDefaultType]);

  const onRefineSpecList = useCallback(async () => {
    if (!opts.projectId || !opts.selectedSpecList) return;
    if (refineItems.length === 0) {
      setRefineError("No refinement items. Parse the SpecList text first.");
      return;
    }
    setRefineBusy(true);
    setRefineError(null);
    try {
      const created: AssetSpec[] = [];
      for (const item of refineItems) {
        if (!item.title.trim()) continue;
        const spec = await createSpec(opts.projectId, {
          title: item.title.trim(),
          assetType: item.assetType,
          specListId: opts.selectedSpecList.id,
          status: "ready"
        });
        created.push(spec);
      }
      if (created.length > 0) {
        await updateSpecList(opts.projectId, opts.selectedSpecList.id, {
          status: "refined",
          derivedSpecIds: created.map((s) => s.id)
        });
      }
      return created;
    } catch (e: any) {
      setRefineError(e?.message ?? String(e));
      opts.onError(e?.message ?? String(e));
      return null;
    } finally {
      setRefineBusy(false);
    }
  }, [opts.projectId, opts.selectedSpecList, opts.onError, refineItems]);

  const updateRefineItem = useCallback((idx: number, patch: Partial<RefineItem>) => {
    setRefineItems((items) => items.map((item, index) => (index === idx ? { ...item, ...patch } : item)));
  }, []);

  const removeRefineItem = useCallback((idx: number) => {
    setRefineItems((items) => items.filter((_, index) => index !== idx));
  }, []);

  const canRefine = useMemo(() => refineItems.length > 0, [refineItems.length]);

  return {
    refineDefaultType,
    setRefineDefaultType,
    refineItems,
    refineBusy,
    refineError,
    canRefine,
    onParseSpecList,
    onRefineSpecList,
    updateRefineItem,
    removeRefineItem
  };
}
