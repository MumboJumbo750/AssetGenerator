import React from "react";
import { Button, Card, Group, Stack, Tabs, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";

import { AdminPage } from "../AdminPage";
import { AutomationPage } from "../AutomationPage";
import { HelpPage } from "../HelpPage";
import { LogsPage } from "../LogsPage";

const CLASSIC_VIEWS = [
  { label: "Overview", path: "/classic/overview" },
  { label: "Specs", path: "/classic/specs" },
  { label: "Review", path: "/classic/review" },
  { label: "Jobs", path: "/classic/jobs" },
  { label: "Assets", path: "/classic/assets" },
  { label: "Atlases", path: "/classic/atlases" },
  { label: "Exports", path: "/classic/exports" },
  { label: "Training", path: "/classic/training" },
  { label: "Pixi", path: "/classic/pixi" },
  { label: "Automation", path: "/classic/automation" },
  { label: "Admin", path: "/classic/admin" },
  { label: "Help", path: "/classic/help" },
  { label: "Logs", path: "/classic/logs" },
];

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>Settings</Title>
        <Text c="dimmed">Project configuration, automation, diagnostics, and migration-safe classic views.</Text>
      </div>

      <Tabs defaultValue="classic">
        <Tabs.List>
          <Tabs.Tab value="classic">Classic views</Tabs.Tab>
          <Tabs.Tab value="automation">Automation</Tabs.Tab>
          <Tabs.Tab value="admin">Admin</Tabs.Tab>
          <Tabs.Tab value="logs">Logs</Tabs.Tab>
          <Tabs.Tab value="help">Help</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="classic" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text fw={600}>Classic views</Text>
              <Text size="sm" c="dimmed">
                Legacy pages remain available while the new zones are rolled out.
              </Text>
              <Group>
                {CLASSIC_VIEWS.map((item) => (
                  <Button key={item.path} variant="light" onClick={() => navigate(item.path)}>
                    {item.label}
                  </Button>
                ))}
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="automation" pt="md">
          <AutomationPage />
        </Tabs.Panel>

        <Tabs.Panel value="admin" pt="md">
          <AdminPage />
        </Tabs.Panel>

        <Tabs.Panel value="logs" pt="md">
          <LogsPage />
        </Tabs.Panel>

        <Tabs.Panel value="help" pt="md">
          <HelpPage />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
