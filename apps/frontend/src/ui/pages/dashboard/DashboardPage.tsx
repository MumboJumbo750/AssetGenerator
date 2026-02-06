import React, { useMemo } from "react";
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";

import { useAppData } from "../../context/AppDataContext";
import { OverviewMetricsPanel } from "../overview/OverviewMetricsPanel";
import { LoraActivationQueue } from "../review/LoraActivationQueue";

export function DashboardPage() {
  const { specs, assets, jobs, systemStatus, refreshProjectData } = useAppData();

  const recentJobs = useMemo(
    () => [...jobs].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 8),
    [jobs],
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={3}>Dashboard</Title>
          <Text c="dimmed">Health snapshot and recent activity.</Text>
        </div>
        <Group gap="xs">
          <Badge variant="light" color={systemStatus?.worker.ok ? "green" : "red"}>
            Worker {systemStatus?.worker.ok ? "OK" : "Down"}
          </Badge>
          <Badge variant="light" color={systemStatus?.comfyui.ok ? "green" : "red"}>
            ComfyUI {systemStatus?.comfyui.ok ? "OK" : "Down"}
          </Badge>
        </Group>
      </Group>

      <OverviewMetricsPanel
        specListsCount={0}
        specsCount={specs.length}
        assetsCount={assets.length}
        jobsCount={jobs.length}
      />

      <LoraActivationQueue jobs={jobs} onRefresh={() => refreshProjectData().catch(() => undefined)} />

      <Card withBorder radius="md" p="md">
        <Stack gap="sm">
          <Text fw={600}>Recent activity</Text>
          {recentJobs.length === 0 && (
            <Text size="sm" c="dimmed">
              No jobs yet.
            </Text>
          )}
          {recentJobs.map((job) => (
            <Group key={job.id} justify="space-between">
              <Text size="sm">
                {job.type} - {job.id}
              </Text>
              <Badge
                size="sm"
                variant="light"
                color={
                  job.status === "succeeded"
                    ? "green"
                    : job.status === "failed"
                      ? "red"
                      : job.status === "running"
                        ? "blue"
                        : "gray"
                }
              >
                {job.status}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
