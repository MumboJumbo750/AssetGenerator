import React from "react";
import { Badge, Card, Group, Select, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { AtlasRecord, AssetSpec } from "../../api";

type Props = {
  animationSpecs: AssetSpec[];
  atlases: AtlasRecord[];
  animationAtlasMap: Record<string, string>;
  onAtlasMapChange: (specId: string, atlasId: string) => void;
};

export function AnimationMappingPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>Animation export mapping</Text>
          <HelpTip label="Link animation specs to atlas IDs." topicId="exports-pixi" />
        </Group>
        <Stack gap="xs">
          {props.animationSpecs.map((spec) => (
            <Card key={spec.id} withBorder radius="sm" p="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {spec.title}
                  </Text>
                  <Badge variant="light">{spec.output?.animation?.frameNames?.length ?? 0} frames</Badge>
                </Group>
                <Select
                  label="Atlas"
                  data={props.atlases.map((atlas) => ({ value: atlas.id, label: atlas.id }))}
                  value={props.animationAtlasMap[spec.id] ?? ""}
                  onChange={(value: string | null) => props.onAtlasMapChange(spec.id, value ?? "")}
                  placeholder="Select atlas for this animation"
                />
              </Stack>
            </Card>
          ))}
          {props.animationSpecs.length === 0 && (
            <Text size="sm">No animation specs yet. Define animations on the Atlases page.</Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
