import { useMemo } from "react";

import type { Job } from "../api";

export function useSelectedJob(jobs: Job[], selectedJobId: string | null) {
  return useMemo(
    () => (selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null),
    [selectedJobId, jobs]
  );
}
