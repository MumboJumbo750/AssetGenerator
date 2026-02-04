import React from "react";
import { Badge, Button, Card, Group, NumberInput, Select, Stack, Switch, Text, TextInput } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { ExportProfile } from "../../api";

type Props = {
  profiles: ExportProfile[];
  profileError: string | null;
  selectedProfileId: string | null;
  profileName: string;
  profileScale: number;
  profileTrim: boolean;
  profilePadding: number;
  profilePrefix: string;
  profileSuffix: string;
  onSelectProfileId: (value: string | null) => void;
  onProfileNameChange: (value: string) => void;
  onProfileScaleChange: (value: number) => void;
  onProfileTrimChange: (value: boolean) => void;
  onProfilePaddingChange: (value: number) => void;
  onProfilePrefixChange: (value: string) => void;
  onProfileSuffixChange: (value: string) => void;
  onCreateProfile: () => void;
  onUpdateProfile: () => void;
  disableUpdate: boolean;
};

export function ExportProfilesPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Export profiles</Text>
            <HelpTip label="Profiles control scale, trim, padding, and naming." topicId="export-profiles" />
          </Group>
          <Badge variant="light">{props.profiles.length}</Badge>
        </Group>
        {props.profileError && <Text size="xs">Profile error: {props.profileError}</Text>}
        <Select
          label="Select profile"
          data={props.profiles.map((profile) => ({ value: profile.id, label: profile.name }))}
          value={props.selectedProfileId}
          onChange={(value: string | null) => props.onSelectProfileId(value ?? null)}
          placeholder="Create or pick a profile"
          searchable
        />
        <TextInput label="Profile name" value={props.profileName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onProfileNameChange(event.currentTarget.value)} />
        <Group grow>
          <NumberInput label="Scale" value={props.profileScale} onChange={(value) => props.onProfileScaleChange(Number(value) || 1)} min={0.1} step={0.1} />
          <NumberInput label="Padding" value={props.profilePadding} onChange={(value) => props.onProfilePaddingChange(Number(value) || 0)} min={0} step={1} />
        </Group>
        <Group align="flex-end">
          <Switch label="Trim transparent edges" checked={props.profileTrim} onChange={(event) => props.onProfileTrimChange(event.currentTarget.checked)} />
        </Group>
        <Group grow>
          <TextInput label="Name prefix" value={props.profilePrefix} onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onProfilePrefixChange(event.currentTarget.value)} />
          <TextInput label="Name suffix" value={props.profileSuffix} onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onProfileSuffixChange(event.currentTarget.value)} />
        </Group>
        <Text size="xs" c="dimmed">
          Scale/trim/padding apply to exported images; atlas images are scaled and renamed for consistency.
        </Text>
        <Group>
          <Button onClick={props.onCreateProfile} variant="light">
            Create profile
          </Button>
          <Button onClick={props.onUpdateProfile} disabled={props.disableUpdate}>
            Update profile
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
