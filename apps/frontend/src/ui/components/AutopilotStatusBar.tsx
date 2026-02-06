import React, { useMemo } from "react";
import { Badge, Group, Text, Tooltip } from "@mantine/core";

import { useAppData } from "../context/AppDataContext";

/**
 * AutopilotStatusBar — persistent status bar rendered inside the AppShell header.
 *
 * Shows at-a-glance:
 *  - Queue depth (queued jobs)
 *  - Active (running) jobs
 *  - Succeeded / Failed counts
 *  - Escalated count (jobs with escalationTarget)
 *  - Retry in-progress count (queued jobs with attempt > 1)
 *  - Event stream health indicator
 */
export function AutopilotStatusBar() {
  const { jobs, eventStreamConnected } = useAppData();

  const stats = useMemo(() => {
    let queued = 0;
    let running = 0;
    let succeeded = 0;
    let failed = 0;
    let escalated = 0;
    let retrying = 0;

    for (const job of jobs) {
      switch (job.status) {
        case "queued":
          queued += 1;
          if (job.attempt && job.attempt > 1) retrying += 1;
          break;
        case "running":
          running += 1;
          break;
        case "succeeded":
          succeeded += 1;
          break;
        case "failed":
          failed += 1;
          if (job.escalatedAt || job.escalationTarget) escalated += 1;
          break;
      }
    }
    return { queued, running, succeeded, failed, escalated, retrying, total: jobs.length };
  }, [jobs]);

  return (
    <Group gap={6} className="ag-autopilot-bar" wrap="nowrap">
      <Tooltip label="Event stream status">
        <Badge size="xs" variant="dot" color={eventStreamConnected ? "green" : "red"} className="ag-autopilot-badge">
          {eventStreamConnected ? "Live" : "Disconnected"}
        </Badge>
      </Tooltip>

      <Tooltip label={`${stats.queued} queued jobs (${stats.retrying} retrying)`}>
        <Badge size="xs" variant="light" color="blue" className="ag-autopilot-badge">
          Q:{stats.queued}
        </Badge>
      </Tooltip>

      <Tooltip label={`${stats.running} actively running jobs`}>
        <Badge size="xs" variant="light" color="cyan" className="ag-autopilot-badge">
          R:{stats.running}
        </Badge>
      </Tooltip>

      {stats.failed > 0 && (
        <Tooltip label={`${stats.failed} failed jobs (${stats.escalated} escalated)`}>
          <Badge size="xs" variant="light" color="red" className="ag-autopilot-badge">
            F:{stats.failed}
          </Badge>
        </Tooltip>
      )}

      {stats.escalated > 0 && (
        <Tooltip label={`${stats.escalated} escalated to exception inbox`}>
          <Badge size="xs" variant="filled" color="orange" className="ag-autopilot-badge">
            ESC:{stats.escalated}
          </Badge>
        </Tooltip>
      )}

      {stats.retrying > 0 && (
        <Tooltip label={`${stats.retrying} jobs queued for retry`}>
          <Badge size="xs" variant="light" color="yellow" className="ag-autopilot-badge">
            RTY:{stats.retrying}
          </Badge>
        </Tooltip>
      )}

      <Text size="xs" c="dimmed" className="ag-autopilot-total">
        {stats.total} jobs
      </Text>
    </Group>
  );
}
