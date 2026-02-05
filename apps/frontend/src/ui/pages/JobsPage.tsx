import React from "react";
import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { cancelJob, retryJob } from "../api";
import { useAppData } from "../context/AppDataContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useJobLog } from "../hooks/useJobLog";
import { useSelectedJob } from "../hooks/useSelectedJob";
import { JobDetailsPanel } from "./jobs/JobDetailsPanel";
import { JobsListPanel } from "./jobs/JobsListPanel";

export function JobsPage() {
  const { selectedProjectId, jobs, selectedJobId, setSelectedJobId, refreshProjectData } = useAppData();

  const selectedJob = useSelectedJob(jobs, selectedJobId);

  const { log, error, refresh } = useJobLog({
    projectId: selectedProjectId,
    jobId: selectedJobId,
    logPath: selectedJob?.logPath,
  });

  const jobAction = useAsyncAction(async (action: "cancel" | "retry") => {
    if (!selectedProjectId || !selectedJobId) return;
    if (action === "cancel") await cancelJob(selectedProjectId, selectedJobId);
    if (action === "retry") await retryJob(selectedProjectId, selectedJobId);
    await refreshProjectData(selectedProjectId);
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Jobs</Title>
          <HelpTip label="Track generation and post-processing progress." topicId="workflow-generation" />
        </Group>
        <Text c="dimmed">Queue and logs</Text>
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <JobsListPanel jobs={jobs} selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
        <JobDetailsPanel
          selectedJob={selectedJob}
          selectedJobId={selectedJobId}
          jobLog={log}
          jobLogError={error}
          onRefreshLog={refresh}
          actionError={jobAction.error}
          actionLoading={jobAction.loading}
          onCancel={() => jobAction.run("cancel").catch(() => undefined)}
          onRetry={() => jobAction.run("retry").catch(() => undefined)}
        />
      </SimpleGrid>
    </Stack>
  );
}
