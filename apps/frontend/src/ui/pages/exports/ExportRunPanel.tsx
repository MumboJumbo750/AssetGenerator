import React from "react";
import { Button, Card, Group, Select, Stack, Text, TextInput } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";

type Props = {
  exportId: string;
  profiles: Array<{ id: string; name: string }>;
  selectedProfileId: string | null;
  missingAnimations: number;
  missingUi: number;
  onExportIdChange: (value: string) => void;
  onSelectProfileId: (value: string | null) => void;
  onRunExport: () => void;
};

export function ExportRunPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>Run export</Text>
          <HelpTip label="Queue a Pixi kit export job." topicId="exports-pixi" />
        </Group>
        <TextInput
          label="Export ID (optional)"
          value={props.exportId}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onExportIdChange(event.currentTarget.value)}
        />
        <Select
          label="Profile to apply"
          data={props.profiles.map((profile) => ({ value: profile.id, label: profile.name }))}
          value={props.selectedProfileId}
          onChange={(value: string | null) => props.onSelectProfileId(value ?? null)}
          placeholder="Optional but recommended"
          searchable
        />
        <Group>
          <Button onClick={props.onRunExport}>Queue export</Button>
        </Group>
        {(props.missingAnimations > 0 || props.missingUi > 0) && (
          <Card withBorder radius="sm" p="sm">
            <Stack gap="xs">
              <Text size="sm" c="red">
                Export warnings
              </Text>
              {props.missingAnimations > 0 && (
                <Text size="xs" c="dimmed">
                  {props.missingAnimations} animation spec(s) missing atlas mapping.
                </Text>
              )}
              {props.missingUi > 0 && (
                <Text size="xs" c="dimmed">
                  {props.missingUi} UI spec(s) missing state mappings.
                </Text>
              )}
              <Text size="xs" c="dimmed">
                Unmapped items will be skipped in the export manifest.
              </Text>
            </Stack>
          </Card>
        )}
        <Text size="xs" c="dimmed">
          Exports show up in Jobs; copy the manifest path into Pixi Preview to validate the kit.
        </Text>
      </Stack>
    </Card>
  );
}
