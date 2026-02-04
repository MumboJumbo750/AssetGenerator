import React from "react";
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { PixiPreview } from "../pixi/PixiPreview";

export function PixiPage() {
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Pixi</Title>
          <HelpTip label="Preview exported kits and verify visuals." topicId="exports-pixi" />
        </Group>
        <Text c="dimmed">Export preview</Text>
      </Group>
      <Card withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={600}>Pixi preview</Text>
              <HelpTip label="Load a Pixi kit manifest to verify exports visually." topicId="exports-pixi" />
            </Group>
            <Badge variant="light">Export kit</Badge>
          </Group>
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Text fw={600}>How to use</Text>
              <Text size="sm" c="dimmed">
                Export a Pixi kit, then paste the manifest path below to preview.
              </Text>
            </Stack>
          </Card>
          <PixiPreview />
        </Stack>
      </Card>
    </Stack>
  );
}
