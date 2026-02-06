import React, { useMemo } from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";

import type { Job } from "../../api";

type LoraActivationQueueProps = {
  jobs: Job[];
  onRefresh?: () => void;
};

type ActivationJobRow = {
  id: string;
  status: Job["status"];
  createdAt: string;
  updatedAt: string;
  specId: string;
  loraId: string;
  releaseId: string;
};

const ACTIVATION_MODES = new Set(["activate_render", "automation_release_activation"]);

function toActivationRows(jobs: Job[]) {
  return jobs
    .filter((job) => job.type === "generate")
    .filter((job) => {
      const loraSelection = job.input?.loraSelection;
      if (!loraSelection || typeof loraSelection !== "object") return false;
      const mode = String((loraSelection as Record<string, unknown>).mode ?? "");
      return ACTIVATION_MODES.has(mode);
    })
    .map((job) => {
      const loraSelection = job.input.loraSelection as Record<string, unknown>;
      return {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        specId: String(job.input.specId ?? "unknown"),
        loraId: String(loraSelection.loraId ?? "unknown"),
        releaseId: String(loraSelection.releaseId ?? "unknown"),
      } satisfies ActivationJobRow;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function formatEta(targetEpochMs: number) {
  const now = Date.now();
  const remainingMs = targetEpochMs - now;
  if (remainingMs <= 0) return "< 1m";
  const mins = Math.ceil(remainingMs / 60_000);
  if (mins < 60) return `~${mins}m`;
  const hours = Math.ceil(mins / 60);
  return `~${hours}h`;
}

function statusColor(status: Job["status"]) {
  if (status === "succeeded") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "blue";
  if (status === "queued") return "yellow";
  return "gray";
}

export function LoraActivationQueue({ jobs, onRefresh }: LoraActivationQueueProps) {
  const rows = useMemo(() => toActivationRows(jobs), [jobs]);

  const summary = useMemo(() => {
    const queued = rows.filter((row) => row.status === "queued").length;
    const running = rows.filter((row) => row.status === "running").length;
    const succeeded = rows.filter((row) => row.status === "succeeded").length;
    const failed = rows.filter((row) => row.status === "failed").length;

    const succeededDurationsMs = rows
      .filter((row) => row.status === "succeeded")
      .map((row) => Math.max(1_000, Date.parse(row.updatedAt) - Date.parse(row.createdAt)));

    const fallbackGenerateDurationsMs = jobs
      .filter((job) => job.type === "generate" && job.status === "succeeded")
      .map((job) => Math.max(1_000, Date.parse(job.updatedAt) - Date.parse(job.createdAt)));

    const medianDurationMs = median(succeededDurationsMs) ?? median(fallbackGenerateDurationsMs) ?? 3 * 60_000;

    const inFlight = rows.filter((row) => row.status === "queued" || row.status === "running");
    const firstOutputEta =
      inFlight.length > 0
        ? inFlight.map((row) => Date.parse(row.createdAt) + medianDurationMs).sort((a, b) => a - b)[0]
        : null;

    return {
      queued,
      running,
      succeeded,
      failed,
      firstOutputEta,
      recent: rows.slice(0, 6),
    };
  }, [jobs, rows]);

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>LoRA activation queue</Text>
          <Group gap="xs">
            {onRefresh && (
              <Button size="compact-xs" variant="light" onClick={onRefresh}>
                Refresh
              </Button>
            )}
            <Badge variant="light">{rows.length} jobs</Badge>
          </Group>
        </Group>

        <Group gap="xs">
          <Badge variant="light" color="yellow">
            Queued {summary.queued}
          </Badge>
          <Badge variant="light" color="blue">
            Running {summary.running}
          </Badge>
          <Badge variant="light" color="green">
            Succeeded {summary.succeeded}
          </Badge>
          <Badge variant="light" color="red">
            Failed {summary.failed}
          </Badge>
          <Badge variant="light" color="indigo">
            First output ETA {summary.firstOutputEta ? formatEta(summary.firstOutputEta) : "done"}
          </Badge>
        </Group>

        {summary.recent.length === 0 && (
          <Text size="sm" c="dimmed">
            No activation-driven render jobs yet.
          </Text>
        )}

        {summary.recent.map((row) => (
          <Group key={row.id} justify="space-between">
            <Text size="sm" lineClamp={1}>
              {row.specId} - {row.loraId}:{row.releaseId}
            </Text>
            <Badge size="sm" variant="light" color={statusColor(row.status)}>
              {row.status}
            </Badge>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
