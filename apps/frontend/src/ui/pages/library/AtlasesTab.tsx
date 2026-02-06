import React, { useMemo } from "react";

import type { AtlasRecord } from "../../api";
import { ImageGrid, type ImageGridItem } from "../../components/ImageGrid";

type AtlasesTabProps = {
  atlases: AtlasRecord[];
  query: string;
  stage: string;
  onSelectItem: (itemId: string) => void;
};

export function AtlasesTab({ atlases, query, stage, onSelectItem }: AtlasesTabProps) {
  const items = useMemo<ImageGridItem[]>(() => {
    return atlases
      .map((atlas) => ({
        id: atlas.id,
        title: atlas.id,
        subtitle: `${atlas.frames.length} frames`,
        imagePath: atlas.imagePath,
        badges: ["atlas"],
        meta: atlas.updatedAt.slice(0, 10),
      }))
      .filter((item) => {
        const q = query.trim().toLowerCase();
        const matchesQuery = !q || item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
        const matchesStage = stage === "all" || stage === "atlas";
        return matchesQuery && matchesStage;
      });
  }, [atlases, query, stage]);

  return <ImageGrid items={items} onSelect={onSelectItem} />;
}
