import React from "react";
import { Button, Card, Group, ScrollArea, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";

type Props = {
  systemLogService: "backend" | "worker";
  systemLog: string;
  systemLogError: string | null;
  onSelectService: (service: "backend" | "worker") => void;
  onRefresh: () => void;
};

export function LogsViewerPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>System logs</Text>
            <HelpTip label="Backend and worker logs help diagnose failures and config issues." topicId="logs-and-debugging" />
          </Group>
          <Group gap="xs">
            <Button size="xs" variant={props.systemLogService === "backend" ? "filled" : "light"} onClick={() => props.onSelectService("backend")}>
              Backend
            </Button>
            <Button size="xs" variant={props.systemLogService === "worker" ? "filled" : "light"} onClick={() => props.onSelectService("worker")}>
              Worker
            </Button>
            <HelpTip label="Switch between backend and worker logs." topicId="logs-and-debugging" />
            <Button size="xs" variant="light" onClick={props.onRefresh}>
              Refresh
            </Button>
          </Group>
        </Group>
        <Card withBorder radius="md" p="md">
          <Stack gap="xs">
            <Text fw={600}>What to look for</Text>
            <Text size="sm" c="dimmed">
              Check here if jobs fail or ComfyUI is down. Logs show the most recent 80k bytes.
            </Text>
          </Stack>
        </Card>
        {props.systemLogError && <Text size="xs">log error: {props.systemLogError}</Text>}
        <ScrollArea h={420}>
          <pre className="log">{props.systemLog || "(empty)"}</pre>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
