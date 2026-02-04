import React from "react";
import { Card, Group, Select, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { AssetSpec } from "../../api";

type UiMapping = { type: string; states: Record<string, string> };

type Props = {
  uiSpecs: AssetSpec[];
  textureOptions: Array<{ value: string; label: string }>;
  uiMappings: Record<string, UiMapping>;
  onUpdateMapping: (specId: string, mapping: UiMapping) => void;
};

export function UiMappingPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>UI state mapping</Text>
          <HelpTip label="Map UI states to textures or atlas frames." topicId="exports-pixi" />
        </Group>
        <Stack gap="xs">
          {props.uiSpecs.map((spec) => {
            const mapping = props.uiMappings[spec.id] ?? { type: "button", states: {} };
            const states = spec.output?.uiStates?.states ?? [];
            return (
              <Card key={spec.id} withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      {spec.title}
                    </Text>
                    <Select
                      label="UI type"
                      data={[
                        { value: "button", label: "button" },
                        { value: "panel", label: "panel" },
                        { value: "icon", label: "icon" }
                      ]}
                      value={mapping.type}
                      onChange={(value: string | null) => props.onUpdateMapping(spec.id, { ...mapping, type: value ?? "button" })}
                    />
                  </Group>
                  {states.map((state: string) => (
                    <Select
                      key={`${spec.id}-${state}`}
                      label={`State: ${state}`}
                      data={props.textureOptions}
                      value={mapping.states?.[state] ?? ""}
                      searchable
                      placeholder="Select texture or frame"
                      onChange={(value: string | null) =>
                        props.onUpdateMapping(spec.id, {
                          ...mapping,
                          states: { ...(mapping.states ?? {}), [state]: value ?? "" }
                        })
                      }
                    />
                  ))}
                </Stack>
              </Card>
            );
          })}
          {props.uiSpecs.length === 0 && <Text size="sm">No UI state specs yet. Add ui_states output on Specs.</Text>}
        </Stack>
      </Stack>
    </Card>
  );
}
