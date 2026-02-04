import React from "react";
import { Group, Stack, Text, Title } from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { LogsViewerPanel } from "./logs/LogsViewerPanel";
import { useSystemLog } from "../hooks/useSystemLog";
import { useSystemLogService } from "../hooks/useSystemLogService";

export function LogsPage() {
  const { systemLogService, setSystemLogService } = useSystemLogService();
  const { log, error, refresh } = useSystemLog(systemLogService);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Logs</Title>
          <HelpTip label="Use logs to debug system and job failures." topicId="logs-and-debugging" />
        </Group>
        <Text c="dimmed">Backend + worker</Text>
      </Group>
      <LogsViewerPanel
        systemLogService={systemLogService}
        systemLog={log}
        systemLogError={error}
        onSelectService={setSystemLogService}
        onRefresh={refresh}
      />
    </Stack>
  );
}
