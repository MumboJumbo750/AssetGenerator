import React, { useMemo } from "react";

import type { Job } from "../../api";
import { ImageGrid, type ImageGridItem } from "../../components/ImageGrid";

type ExportsHistoryTabProps = {
  jobs: Job[];
  query: string;
  status: string;
  stage: string;
  onSelectItem: (itemId: string) => void;
};

export function ExportsHistoryTab({ jobs, query, status, stage, onSelectItem }: ExportsHistoryTabProps) {
  const items = useMemo<ImageGridItem[]>(() => {
    return jobs
      .filter((job) => job.type === "export")
      .map((job) => ({
        id: job.id,
        title: `Export ${job.id}`,
        subtitle: typeof job.input?.exportId === "string" ? (job.input.exportId as string) : undefined,
        badges: [job.status],
        meta: job.updatedAt.slice(0, 16).replace("T", " "),
      }))
      .filter((item) => {
        const q = query.trim().toLowerCase();
        const matchesQuery = !q || item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
        const matchesStatus = status === "all" || item.badges?.[0] === status;
        const matchesStage = stage === "all" || stage === "exported";
        return matchesQuery && matchesStatus && matchesStage;
      });
  }, [jobs, query, stage, status]);

  return <ImageGrid items={items} onSelect={onSelectItem} />;
}
