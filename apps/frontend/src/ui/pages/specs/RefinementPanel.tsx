import React from "react";
import { Badge, Button, Card, Group, Select, Stack, Text, TextInput, Textarea } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { SpecListItem } from "../../types/viewModels";
import type { SpecList } from "../../api";

type RefineItem = { title: string; assetType: string };

type Props = {
  selectedSpecList: (SpecListItem & Pick<SpecList, "text">) | null;
  assetTypeOptions: string[];
  refineDefaultType: string;
  refineItems: RefineItem[];
  refineBusy: boolean;
  refineError: string | null;
  onDefaultTypeChange: (value: string) => void;
  onParseSpecList: () => void;
  onRefineSpecList: () => void;
  onUpdateItem: (idx: number, patch: Partial<RefineItem>) => void;
  onRemoveItem: (idx: number) => void;
};

export function RefinementPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Refinement</Text>
            <HelpTip label="Parse the SpecList into individual AssetSpecs you can generate." topicId="workflow-specs" />
          </Group>
          <Badge variant="light">SpecList → Specs</Badge>
        </Group>
        {!props.selectedSpecList && <Text size="sm">Select a SpecList to start refinement.</Text>}
        {props.selectedSpecList && (
          <>
            <Text size="sm" c="dimmed">
              Selected: {props.selectedSpecList.title}
            </Text>
            <Textarea readOnly value={props.selectedSpecList.text} minRows={4} />
            <Group>
              <Select
                data={props.assetTypeOptions}
                value={props.refineDefaultType}
                onChange={(value: string | null) =>
                  props.onDefaultTypeChange(value ?? props.assetTypeOptions[0] ?? "ui_icon")
                }
              />
              <Group gap="xs">
                <Button variant="light" onClick={props.onParseSpecList}>
                  Parse SpecList
                </Button>
                <HelpTip
                  label="Parse each line into a spec. Use assetType: prefix to override."
                  topicId="workflow-specs"
                />
              </Group>
              <Group gap="xs">
                <Button
                  onClick={props.onRefineSpecList}
                  loading={props.refineBusy}
                  disabled={props.refineItems.length === 0}
                >
                  Create Specs
                </Button>
                <HelpTip label="Create AssetSpecs from the parsed SpecList items." topicId="workflow-specs" />
              </Group>
            </Group>
            {props.refineError && <Text size="xs">Error: {props.refineError}</Text>}
            {props.refineItems.length === 0 && <Text size="xs">No items parsed yet.</Text>}
            {props.refineItems.length > 0 && (
              <Stack gap="xs">
                {props.refineItems.map((item, idx) => (
                  <Group key={`${item.title}-${idx}`} grow>
                    <Select
                      data={props.assetTypeOptions}
                      value={item.assetType}
                      onChange={(value: string | null) =>
                        props.onUpdateItem(idx, { assetType: value ?? props.assetTypeOptions[0] ?? "ui_icon" })
                      }
                    />
                    <TextInput
                      value={item.title}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        props.onUpdateItem(idx, { title: event.currentTarget.value })
                      }
                    />
                    <Button variant="light" color="red" onClick={() => props.onRemoveItem(idx)}>
                      Remove
                    </Button>
                  </Group>
                ))}
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
