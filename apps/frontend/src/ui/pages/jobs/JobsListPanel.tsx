import React from "react";
import { Badge, Button, Card, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";

import { HelpTip } from "../../components/HelpTip";
import type { Job } from "../../api";

type Props = {
  jobs: Job[];
  selectedJobId: string;
  onSelectJob: (id: string) => void;
};

export function JobsListPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Jobs</Text>
            <HelpTip label="Track generation and post-processing jobs; click to see details." topicId="workflow-generation" />
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
            {props.jobs.map((job) => (
              <Card
                key={job.id}
                withBorder
                radius="sm"
                p="sm"
                style={{ cursor: "pointer", borderColor: job.id === props.selectedJobId ? "#6d7cff" : undefined }}
                onClick={() => props.onSelectJob(job.id)}
              >
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>
                      {job.type} - {job.status}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(job.createdAt).toLocaleString()}
                    </Text>
                  </div>
                  {job.error && <Badge color="red">error</Badge>}
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
