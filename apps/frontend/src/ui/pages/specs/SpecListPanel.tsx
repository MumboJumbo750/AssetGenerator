import React from "react";
import { Badge, Button, Card, Divider, Group, ScrollArea, Stack, Text, TextInput, Textarea } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { SpecListItem } from "../../types/viewModels";

type Props = {
  specLists: SpecListItem[];
  selectedSpecListId: string;
  onSelectSpecList: (id: string) => void;
  specTitle: string;
  specText: string;
  assetTypeCatalogError: string | null;
  onSpecTitleChange: (value: string) => void;
  onSpecTextChange: (value: string) => void;
  onCreateSpecList: () => void;
};

export function SpecListPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md" id="specs-create">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>SpecLists</Text>
            <HelpTip label="A SpecList is a wishlist you refine into structured AssetSpecs." topicId="workflow-specs" />
          </Group>
          <Badge variant="light">{props.specLists.length}</Badge>
        </Group>
        {props.assetTypeCatalogError && <Text size="xs">Asset type catalog error: {props.assetTypeCatalogError}</Text>}
        <ScrollArea h={220}>
          <Stack gap={6}>
            {props.specLists.map((specList) => (
              <Button
                key={specList.id}
                variant={specList.id === props.selectedSpecListId ? "filled" : "light"}
                color={specList.id === props.selectedSpecListId ? "indigo" : "gray"}
                justify="space-between"
                onClick={() => props.onSelectSpecList(specList.id)}
              >
                <span>{specList.title}</span>
              </Button>
            ))}
            {props.specLists.length === 0 && <Text size="xs">No SpecLists yet.</Text>}
          </Stack>
        </ScrollArea>
        <Divider />
        <TextInput
          label={
            <Group gap="xs">
              <span>SpecList title</span>
              <HelpTip label="Short, unique titles make your SpecLists easier to scan." topicId="workflow-specs" />
            </Group>
          }
          placeholder="SpecList title"
          value={props.specTitle}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onSpecTitleChange(event.currentTarget.value)}
        />
        <Textarea
          label={
            <Group gap="xs">
              <span>SpecList text</span>
              <HelpTip label="One idea per line. Prefix with assetType: if needed." topicId="workflow-specs" />
            </Group>
          }
          placeholder="SpecList text"
          value={props.specText}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => props.onSpecTextChange(event.currentTarget.value)}
          minRows={4}
        />
        <Button onClick={props.onCreateSpecList} disabled={!props.specTitle.trim() || !props.specText.trim()}>
          Add SpecList
        </Button>
        <Text size="xs" c="dimmed">
          Tip: follow <code>docs/how-to-spec.md</code> for smooth refinement.
        </Text>
      </Stack>
    </Card>
  );
}
