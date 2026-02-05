import React from "react";
import { Badge, Button, Card, Group, Select, Stack, Text, TextInput } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { AssetFilters, TagOption } from "../../types/viewModels";

type Props = {
  assetsCount: number;
  filteredCount: number;
  searchQuery: string;
  statusFilter: AssetFilters["statusFilter"];
  tagFilter: AssetFilters["tagFilter"];
  assetTypeFilter: AssetFilters["assetTypeFilter"];
  assetTypeOptions: TagOption[];
  tagOptions: TagOption[];
  savedFilters: Array<{ name: string } & AssetFilters>;
  savedFilterName: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: AssetFilters["statusFilter"]) => void;
  onTagChange: (value: AssetFilters["tagFilter"]) => void;
  onAssetTypeChange: (value: AssetFilters["assetTypeFilter"]) => void;
  onClearFilters: () => void;
  onPresetNeedsReview: () => void;
  onPresetSelected: () => void;
  onPresetRejected: () => void;
  onSavedFilterNameChange: (value: string) => void;
  onSaveFilter: () => void;
  onApplyFilter: (filter: AssetFilters) => void;
  onRemoveFilter: (name: string) => void;
};

export function AssetFiltersPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Assets</Text>
            <HelpTip
              label="Assets are created by generation jobs; select one to review variants."
              topicId="workflow-generation"
            />
          </Group>
          <Badge variant="light">
            {props.filteredCount}/{props.assetsCount}
          </Badge>
        </Group>
        <Card withBorder radius="md" p="md">
          <Stack gap="xs">
            <Group gap="xs">
              <Text fw={600}>Search & filter</Text>
              <HelpTip label="Filters use tags, status, and asset type." topicId="filters-and-bulk-actions" />
            </Group>
            <Group>
              <Text size="xs" c="dimmed">
                Quick presets
              </Text>
              <Button size="xs" variant="light" onClick={props.onClearFilters}>
                All
              </Button>
              <Button size="xs" variant="light" onClick={props.onPresetNeedsReview}>
                Needs review
              </Button>
              <Button size="xs" variant="light" onClick={props.onPresetSelected}>
                Selected
              </Button>
              <Button size="xs" variant="light" onClick={props.onPresetRejected}>
                Rejected
              </Button>
              <HelpTip label="Use presets to focus your review batches." topicId="filters-and-bulk-actions" />
            </Group>
            <Group>
              <Text size="xs" c="dimmed">
                Saved filters
              </Text>
              {props.savedFilters.length === 0 && (
                <Text size="xs" c="dimmed">
                  None yet
                </Text>
              )}
              {props.savedFilters.map((filter) => (
                <Group key={filter.name} gap="xs">
                  <Button size="xs" variant="light" onClick={() => props.onApplyFilter(filter)}>
                    {filter.name}
                  </Button>
                  <Button size="xs" variant="subtle" color="red" onClick={() => props.onRemoveFilter(filter.name)}>
                    Remove
                  </Button>
                </Group>
              ))}
              <HelpTip label="Save the current filter set for quick reuse." topicId="filters-and-bulk-actions" />
            </Group>
            <Group>
              <TextInput
                placeholder="Save filter as..."
                value={props.savedFilterName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  props.onSavedFilterNameChange(event.currentTarget.value)
                }
              />
              <Button variant="light" onClick={props.onSaveFilter} disabled={!props.savedFilterName.trim()}>
                Save
              </Button>
            </Group>
            <TextInput
              label={
                <Group gap="xs">
                  <span>Search</span>
                  <HelpTip label="Search by asset id, title, type, or tags." topicId="filters-and-bulk-actions" />
                </Group>
              }
              placeholder="Search by id, spec title, type, or tag"
              value={props.searchQuery}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onSearchChange(event.currentTarget.value)}
            />
            <Group grow>
              <Select
                label={
                  <Group gap="xs">
                    <span>Asset type</span>
                    <HelpTip label="Filter by asset type (from specs)." topicId="filters-and-bulk-actions" />
                  </Group>
                }
                placeholder="Asset type"
                data={props.assetTypeOptions}
                value={props.assetTypeFilter}
                onChange={(value: string | null) => props.onAssetTypeChange(value)}
                clearable
              />
              <Select
                label={
                  <Group gap="xs">
                    <span>Status</span>
                    <HelpTip
                      label="Filter by review status (candidate/selected/rejected)."
                      topicId="filters-and-bulk-actions"
                    />
                  </Group>
                }
                placeholder="Status"
                data={[
                  { value: "candidate", label: "candidate" },
                  { value: "selected", label: "selected" },
                  { value: "rejected", label: "rejected" },
                ]}
                value={props.statusFilter}
                onChange={(value: string | null) => props.onStatusChange((value ?? null) as any)}
                clearable
              />
              <Select
                label={
                  <Group gap="xs">
                    <span>Tag</span>
                    <HelpTip label="Filter by tag (from catalog)." topicId="filters-and-bulk-actions" />
                  </Group>
                }
                placeholder="Tag"
                data={props.tagOptions}
                value={props.tagFilter}
                onChange={(value: string | null) => props.onTagChange(value)}
                clearable
                searchable
              />
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Card>
  );
}
