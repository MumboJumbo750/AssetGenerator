import React from "react";
import { Badge, Button, Card, Group, ScrollArea, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { AssetSpec } from "../../api";

type Props = {
  specs: AssetSpec[];
  onParseSpecList: () => void;
  onRefineSpecList: () => void;
  refineItemsCount: number;
  onQueueGenerate: (spec: AssetSpec) => void;
};

export function SpecsListPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Specs</Text>
            <HelpTip label="AssetSpecs are structured definitions used to generate variants." topicId="workflow-specs" />
          </Group>
          <Badge variant="light">{props.specs.length}</Badge>
        </Group>
        {props.specs.length === 0 && (
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Text fw={600}>No specs yet</Text>
              <Text size="sm" c="dimmed">
                Parse a SpecList and create AssetSpecs to start generating assets.
              </Text>
              <Group>
                <Button variant="light" onClick={props.onParseSpecList}>
                  Parse SpecList
                </Button>
                <Button onClick={props.onRefineSpecList} disabled={props.refineItemsCount === 0}>
                  Create Specs
                </Button>
                <HelpTip label="Specs are the structured inputs for generation jobs." topicId="workflow-specs" />
              </Group>
            </Stack>
          </Card>
        )}
        <ScrollArea h={200}>
          <Stack gap="xs">
            {props.specs.slice(0, 12).map((spec) => (
              <Card key={spec.id} withBorder radius="sm" p="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{spec.title}</Text>
                    <Text size="xs" c="dimmed">
                      {spec.assetType} · {spec.style}/{spec.scenario}
                    </Text>
                  </div>
                  <Button variant="light" onClick={() => props.onQueueGenerate(spec)}>
                    Queue generate
                  </Button>
                  <HelpTip label="Queue a generation job for this spec." topicId="workflow-generation" />
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
