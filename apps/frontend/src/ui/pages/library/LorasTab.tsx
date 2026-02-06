import React, { useMemo } from "react";

import type { LoraEval, LoraRecord } from "../../api";
import { ImageGrid, type ImageGridItem } from "../../components/ImageGrid";

type LoraWithScope = LoraRecord & { scopeLabel: "project" | "baseline" };

type LorasTabProps = {
  loras: LoraWithScope[];
  evals: LoraEval[];
  query: string;
  stage: string;
  onSelectItem: (itemId: string) => void;
};

export function LorasTab({ loras, evals, query, stage, onSelectItem }: LorasTabProps) {
  const items = useMemo<ImageGridItem[]>(() => {
    return loras
      .map((lora) => ({
        id: lora.id,
        title: lora.name,
        subtitle: lora.id,
        badges: [lora.scopeLabel, lora.checkpointId],
        meta: `${lora.releases.length} releases, ${evals.filter((entry) => entry.loraId === lora.id).length} evals`,
      }))
      .filter((item) => {
        const q = query.trim().toLowerCase();
        const matchesQuery = !q || item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q);
        const matchesStage = stage === "all";
        return matchesQuery && matchesStage;
      });
  }, [evals, loras, query, stage]);

  return <ImageGrid items={items} onSelect={onSelectItem} />;
}
