import React from "react";
import { Button, Card, Group, List, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";

import { HelpTip } from "../../components/HelpTip";

export function GettingStartedPanel() {
  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Getting started</Text>
        <HelpTip label="Noob-friendly checklist to reach your first export." topicId="getting-started-first-project" />
      </Group>
      <List spacing="xs" size="sm">
        <List.Item>Seed demo data (`npm run seed`) or create a project.</List.Item>
        <List.Item>Create a SpecList (use `docs/how-to-spec.md`).</List.Item>
        <List.Item>Refine into AssetSpecs and queue generation jobs.</List.Item>
        <List.Item>Review variants, tag, and set a primary.</List.Item>
        <List.Item>Export and preview in Pixi.</List.Item>
      </List>
    </Card>
  );
}
