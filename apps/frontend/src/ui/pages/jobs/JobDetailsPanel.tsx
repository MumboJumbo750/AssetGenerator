import React from "react";
import { Button, Card, Divider, Group, ScrollArea, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { Job } from "../../api";

type Props = {
  selectedJob: Job | null;
  selectedJobId: string;
  jobLog: string;
  jobLogError: string | null;
  onRefreshLog: () => void;
  onCancel: () => void;
  onRetry: () => void;
  actionLoading: boolean;
  actionError: string | null;
};

export function JobDetailsPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Job details</Text>
            <HelpTip label="Logs + input/output help debug pipeline issues quickly." topicId="logs-and-debugging" />
          </Group>
          <Group gap="xs">
            <Button variant="light" onClick={props.onRefreshLog} disabled={!props.selectedJobId}>
              Refresh log
            </Button>
            <Button
              variant="light"
              color="red"
              onClick={props.onCancel}
              disabled={
                !props.selectedJobId || !props.selectedJob || !["queued", "running"].includes(props.selectedJob.status)
              }
              loading={props.actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="light"
              onClick={props.onRetry}
              disabled={
                !props.selectedJobId || !props.selectedJob || !["failed", "canceled"].includes(props.selectedJob.status)
              }
              loading={props.actionLoading}
            >
              Retry
            </Button>
            <HelpTip label="Refresh to pull the latest job output and errors." topicId="logs-and-debugging" />
          </Group>
        </Group>
        {props.actionError && (
          <Text size="xs" c="red">
            {props.actionError}
          </Text>
        )}
        {props.selectedJob ? (
          <>
            <Text size="xs" c="dimmed">
              id: {props.selectedJob.id}
            </Text>
            {props.selectedJob.error && <Text size="xs">error: {props.selectedJob.error}</Text>}
            {!props.selectedJob.logPath && <Text size="xs">No logPath yet (older jobs may not have logs).</Text>}
            {props.jobLogError && <Text size="xs">log error: {props.jobLogError}</Text>}
            {props.selectedJob.logPath && (
              <ScrollArea h={200}>
                <pre className="log">{props.jobLog || "(empty)"}</pre>
              </ScrollArea>
            )}
            <Divider />
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                input
              </Text>
              <HelpTip label="Inspect job inputs to verify settings and placeholders." topicId="workflow-generation" />
            </Group>
            <ScrollArea h={140}>
              <pre className="log">{JSON.stringify(props.selectedJob.input ?? {}, null, 2)}</pre>
            </ScrollArea>
            {props.selectedJob.output && (
              <>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    output
                  </Text>
                  <HelpTip label="Review output paths and IDs created by the job." topicId="workflow-generation" />
                </Group>
                <ScrollArea h={140}>
                  <pre className="log">{JSON.stringify(props.selectedJob.output ?? {}, null, 2)}</pre>
                </ScrollArea>
              </>
            )}
          </>
        ) : (
          <Text size="sm">Pick a job on the left to view details.</Text>
        )}
      </Stack>
    </Card>
  );
}
