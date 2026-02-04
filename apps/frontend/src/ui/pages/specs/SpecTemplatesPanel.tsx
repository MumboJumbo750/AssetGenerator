import React from "react";
import { Button, Card, Group, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";

type Template = { id: string; label: string };

type Props = {
  templates: Template[];
  onApplyTemplate: (id: string) => void;
};

export function SpecTemplatesPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>Templates</Text>
          <HelpTip label="Start with a template to avoid prompt mistakes and get consistent results." topicId="workflow-generation" />
        </Group>
        <Group>
          {props.templates.map((template) => (
            <Button key={template.id} variant="light" onClick={() => props.onApplyTemplate(template.id)}>
              {template.label}
            </Button>
          ))}
          {props.templates.length === 0 && (
            <Text size="xs" c="dimmed">
              No templates available for the configured asset types.
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
