import React from "react";
import { Badge, Button, Card, Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { TagOption } from "../../types/viewModels";

type Props = {
  selectionCount: number;
  bulkBusy: boolean;
  tagOptions: TagOption[];
  bulkTagId: string | null;
  bulkMode: "add" | "remove";
  bulkCheckpointName: string;
  bulkWidth: number;
  bulkHeight: number;
  bulkVariants: number;
  bgThreshold: number | null;
  bgFeather: number;
  bgErode: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onBulkTagIdChange: (value: string | null) => void;
  onBulkModeChange: (value: "add" | "remove") => void;
  onApplyTag: () => void;
  onCheckpointNameChange: (value: string) => void;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onVariantsChange: (value: number) => void;
  onRegenerate: () => void;
  onBgThresholdChange: (value: number | null) => void;
  onBgFeatherChange: (value: number) => void;
  onBgErodeChange: (value: number) => void;
  onRunBgRemove: () => void;
  onResetBgParams: () => void;
  disableSelectAll: boolean;
};

export function BulkActionsPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Bulk actions</Text>
            <HelpTip label="Apply status, tags, or regeneration in batches." topicId="filters-and-bulk-actions" />
          </Group>
          <Badge variant="light">{props.selectionCount} selected</Badge>
        </Group>
        <Group>
          <Group gap="xs">
            <Button variant="light" onClick={props.onSelectAll} disabled={props.disableSelectAll}>
              Select all
            </Button>
            <HelpTip
              label="Select everything in the filtered list for bulk actions."
              topicId="filters-and-bulk-actions"
            />
          </Group>
          <Group gap="xs">
            <Button variant="light" onClick={props.onClearSelection} disabled={props.selectionCount === 0}>
              Clear selection
            </Button>
            <HelpTip label="Clear the current bulk selection." topicId="filters-and-bulk-actions" />
          </Group>
        </Group>
        <Group>
          <Group gap="xs">
            <Button
              color="green"
              onClick={props.onApproveSelected}
              disabled={props.selectionCount === 0 || props.bulkBusy}
            >
              Approve selected
            </Button>
            <HelpTip label="Bulk-approve the primary variant for each selected asset." topicId="ratings-and-status" />
          </Group>
          <Button
            color="red"
            variant="light"
            onClick={props.onRejectSelected}
            disabled={props.selectionCount === 0 || props.bulkBusy}
          >
            Reject selected
          </Button>
        </Group>
        <Group grow>
          <Select
            label={
              <Group gap="xs">
                <span>Tag</span>
                <HelpTip label="Apply or remove one tag across selected assets." topicId="filters-and-bulk-actions" />
              </Group>
            }
            placeholder="Tag"
            data={props.tagOptions}
            value={props.bulkTagId}
            onChange={(value: string | null) => props.onBulkTagIdChange(value)}
            clearable
            searchable
          />
          <Select
            label={
              <Group gap="xs">
                <span>Mode</span>
                <HelpTip label="Choose whether the tag is added or removed." topicId="filters-and-bulk-actions" />
              </Group>
            }
            placeholder="Mode"
            data={[
              { value: "add", label: "add" },
              { value: "remove", label: "remove" },
            ]}
            value={props.bulkMode}
            onChange={(value: string | null) => props.onBulkModeChange((value ?? "add") as "add" | "remove")}
          />
        </Group>
        <Group>
          <Group gap="xs">
            <Button
              variant="light"
              onClick={props.onApplyTag}
              disabled={props.selectionCount === 0 || props.bulkBusy || !props.bulkTagId}
            >
              Apply tag
            </Button>
            <HelpTip label="Apply the selected tag action to all selected assets." topicId="filters-and-bulk-actions" />
          </Group>
        </Group>
        <Group grow>
          <TextInput
            label={
              <Group gap="xs">
                <span>Checkpoint name</span>
                <HelpTip label="Choose the checkpoint for regeneration jobs." topicId="workflow-generation" />
              </Group>
            }
            placeholder="Checkpoint name"
            value={props.bulkCheckpointName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              props.onCheckpointNameChange(event.currentTarget.value)
            }
          />
          <NumberInput
            value={props.bulkWidth}
            onChange={(value) => props.onWidthChange(Number(value) || 512)}
            min={64}
            step={64}
          />
          <NumberInput
            value={props.bulkHeight}
            onChange={(value) => props.onHeightChange(Number(value) || 512)}
            min={64}
            step={64}
          />
          <NumberInput
            value={props.bulkVariants}
            onChange={(value) => props.onVariantsChange(Number(value) || 1)}
            min={1}
            max={16}
          />
        </Group>
        <Group>
          <Group gap="xs">
            <Button
              variant="light"
              onClick={props.onRegenerate}
              disabled={props.selectionCount === 0 || props.bulkBusy}
            >
              Regenerate selected
            </Button>
            <HelpTip label="Queue new generation jobs for the selected assets." topicId="filters-and-bulk-actions" />
          </Group>
        </Group>
        <Text size="xs" c="dimmed">
          Background removal runs on the primary/selected variant of approved versions only.
        </Text>
        <Group grow>
          <NumberInput
            label={
              <Group gap="xs">
                <span>BG threshold</span>
                <HelpTip label="Alpha cutoff (0–255). Leave blank for default." topicId="background-removal" />
              </Group>
            }
            value={props.bgThreshold ?? undefined}
            onChange={(value) => props.onBgThresholdChange(value === "" || value === null ? null : Number(value))}
            min={0}
            max={255}
            placeholder="default"
          />
          <NumberInput
            label={
              <Group gap="xs">
                <span>Feather</span>
                <HelpTip label="Soft blur radius on alpha edges." topicId="background-removal" />
              </Group>
            }
            value={props.bgFeather}
            onChange={(value) => props.onBgFeatherChange(Number(value) || 0)}
            min={0}
            max={20}
            placeholder="0"
          />
          <NumberInput
            label={
              <Group gap="xs">
                <span>Erode</span>
                <HelpTip label="Shrink alpha edges to reduce halos." topicId="background-removal" />
              </Group>
            }
            value={props.bgErode}
            onChange={(value) => props.onBgErodeChange(Number(value) || 0)}
            min={0}
            max={20}
            placeholder="0"
          />
        </Group>
        <Group>
          <Group gap="xs">
            <Button
              variant="light"
              onClick={props.onRunBgRemove}
              disabled={props.selectionCount === 0 || props.bulkBusy}
            >
              Run bg removal
            </Button>
            <HelpTip label="Runs background removal for approved variants only." topicId="background-removal" />
          </Group>
          <Button variant="subtle" onClick={props.onResetBgParams}>
            Reset params
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
