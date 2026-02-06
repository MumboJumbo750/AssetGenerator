import React from "react";
import { Card, Stack, Tabs, Text, Title } from "@mantine/core";

import { PixiPreview } from "../../pixi/PixiPreview";
import { ExportsPage as LegacyExportsPage } from "../ExportsPage";

export function ExportPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>Export</Title>
        <Text c="dimmed">Configure export kits and verify results with live preview.</Text>
      </div>

      <Tabs defaultValue="wizard">
        <Tabs.List>
          <Tabs.Tab value="wizard">Export wizard</Tabs.Tab>
          <Tabs.Tab value="preview">Pixi preview</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="wizard" pt="md">
          <LegacyExportsPage />
        </Tabs.Panel>

        <Tabs.Panel value="preview" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text fw={600}>Preview exported kit</Text>
              <Text size="sm" c="dimmed">
                Paste a manifest path to verify animation and texture wiring.
              </Text>
              <PixiPreview />
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
