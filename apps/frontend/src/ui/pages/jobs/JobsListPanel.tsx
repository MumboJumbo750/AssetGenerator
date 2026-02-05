import React from "react";
import { Badge, Button, Card, Group, Progress, ScrollArea, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";

import { HelpTip } from "../../components/HelpTip";
import type { Job } from "../../api";

type Props = {
  jobs: Job[];
  selectedJobId: string;
  onSelectJob: (id: string) => void;
};

export function JobsListPanel(props: Props) {
  const progressFor = (job: Job) => {
    const progress = (job.output as any)?.progress;
    const percentRaw = typeof progress?.percent === "number" ? progress.percent : null;
    const percent = percentRaw !== null && percentRaw > 0 ? percentRaw : null;
    switch (job.status) {
      case "queued":
        return { value: 15, color: "gray", animated: false, label: "Queued", percent: null };
      case "running":
        return {
          value: percent ?? 100,
          color: "blue",
          animated: percent === null,
          striped: percent === null,
          label: percent === null ? "Running" : `${percent}%`,
          percent,
        };
      case "succeeded":
        return { value: 100, color: "green", animated: false, label: "Done", percent: 100 };
      case "failed":
        return { value: 100, color: "red", animated: false, label: "Failed", percent: 100 };
      case "canceled":
        return { value: 100, color: "orange", animated: false, label: "Canceled", percent: 100 };
      default:
        return { value: 0, color: "gray", animated: false, label: "", percent: null };
    }
  };

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Jobs</Text>
            <HelpTip
              label="Track generation and post-processing jobs; click to see details."
              topicId="workflow-generation"
            />
          </Group>
          <Badge variant="light">{props.jobs.length}</Badge>
        </Group>
        {props.jobs.length === 0 && (
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Text fw={600}>No jobs yet</Text>
              <Text size="sm" c="dimmed">
                Queue a generation job from a spec to see job progress here.
              </Text>
              <Group>
                <Button component={Link} to="/specs">
                  Go to Specs
                </Button>
                <Button component={Link} to="/assets" variant="light">
                  Review assets
                </Button>
              </Group>
            </Stack>
          </Card>
        )}
        <ScrollArea h={520}>
          <Stack gap="xs">
            {props.jobs.map((job) => {
              const progress = progressFor(job);
              return (
                <Card
                  key={job.id}
                  withBorder
                  radius="sm"
                  p="sm"
                  style={{ cursor: "pointer", borderColor: job.id === props.selectedJobId ? "#6d7cff" : undefined }}
                  onClick={() => props.onSelectJob(job.id)}
                >
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text fw={600}>
                        {job.type} - {job.status}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(job.createdAt).toLocaleString()}
                      </Text>
                      <Progress
                        mt="xs"
                        size="xs"
                        value={progress.value}
                        color={progress.color}
                        striped={progress.striped ?? progress.animated}
                        animated={progress.animated}
                      />
                      {progress.label && (
                        <Text size="xs" c="dimmed">
                          {progress.label}
                        </Text>
                      )}
                    </div>
                    {job.error && <Badge color="red">error</Badge>}
                  </Group>
                </Card>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
