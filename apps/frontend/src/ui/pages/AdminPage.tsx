import React, { useState } from "react";
import { Badge, Button, Card, Group, Select, SimpleGrid, Stack, Tabs, Text, Textarea, Title } from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";
import {
  createCheckpoint,
  createExportProfile,
  getCatalog,
  listCheckpoints,
  listExportProfiles,
  listProjectLoras,
  listSharedLoras,
  type CheckpointRecord,
  type ExportProfile,
  updateCatalog,
  updateCheckpoint,
  updateExportProfile,
  updateProjectLora,
  updateSharedLora,
} from "../api";
import { useAsyncAction } from "../hooks/useAsyncAction";

const CATALOGS = [
  { value: "asset-types", label: "Asset Types" },
  { value: "styles", label: "Styles" },
  { value: "scenarios", label: "Scenarios" },
  { value: "palettes", label: "Palettes" },
  { value: "tags", label: "Tags" },
];

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function AdminPage() {
  const { selectedProjectId } = useAppData();
  const [catalogId, setCatalogId] = useState("asset-types");
  const [catalogJson, setCatalogJson] = useState("{}");
  const [catalogStatus, setCatalogStatus] = useState("");

  const [checkpointList, setCheckpointList] = useState<CheckpointRecord[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [checkpointJson, setCheckpointJson] = useState("{}");

  const [exportProfiles, setExportProfiles] = useState<ExportProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileJson, setProfileJson] = useState("{}");

  const [loraScope, setLoraScope] = useState<"project" | "baseline">("project");
  const [loraList, setLoraList] = useState<any[]>([]);

  const catalogAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const catalog = await getCatalog(selectedProjectId, catalogId);
    setCatalogJson(pretty(catalog));
    setCatalogStatus("Loaded");
  });

  const saveCatalogAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const parsed = JSON.parse(catalogJson);
    await updateCatalog(selectedProjectId, catalogId, parsed);
    setCatalogStatus("Saved");
  });

  const checkpointsAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const result = await listCheckpoints(selectedProjectId);
    setCheckpointList(result.checkpoints ?? []);
  });

  const loadCheckpointAction = useAsyncAction(async (checkpointId: string) => {
    const checkpoint = checkpointList.find((c) => c.id === checkpointId);
    if (!checkpoint) return;
    setCheckpointJson(pretty(checkpoint));
  });

  const saveCheckpointAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const parsed = JSON.parse(checkpointJson) as Partial<CheckpointRecord>;
    if (parsed.id && checkpointList.some((c) => c.id === parsed.id)) {
      await updateCheckpoint(selectedProjectId, parsed.id, parsed);
    } else {
      const created = await createCheckpoint(selectedProjectId, parsed);
      setSelectedCheckpointId(created.id);
    }
    await checkpointsAction.run();
  });

  const profilesAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const result = await listExportProfiles(selectedProjectId);
    setExportProfiles(result.profiles ?? []);
  });

  const loadProfileAction = useAsyncAction(async (profileId: string) => {
    const profile = exportProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    setProfileJson(pretty(profile));
  });

  const saveProfileAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const parsed = JSON.parse(profileJson) as Partial<ExportProfile>;
    if (parsed.id && exportProfiles.some((p) => p.id === parsed.id)) {
      await updateExportProfile(selectedProjectId, parsed.id, parsed);
    } else {
      await createExportProfile(selectedProjectId, parsed);
    }
    await profilesAction.run();
  });

  const loraAction = useAsyncAction(async () => {
    if (!selectedProjectId && loraScope === "project") return;
    const result = loraScope === "baseline" ? await listSharedLoras() : await listProjectLoras(selectedProjectId);
    setLoraList(result.loras ?? []);
  });

  React.useEffect(() => {
    if (selectedProjectId) {
      checkpointsAction.run().catch(() => undefined);
      profilesAction.run().catch(() => undefined);
      catalogAction.run().catch(() => undefined);
    }
  }, [selectedProjectId]);

  React.useEffect(() => {
    if (!selectedProjectId) return;
    catalogAction.run().catch(() => undefined);
  }, [catalogId, selectedProjectId]);

  React.useEffect(() => {
    loraAction.run().catch(() => undefined);
  }, [loraScope, selectedProjectId]);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Admin Console</Title>
          <HelpTip label="Manage catalogs, checkpoints, LoRAs, and export profiles." topicId="admin-console" />
        </Group>
        <Badge variant="light">Checkpoint J</Badge>
      </Group>

      <Tabs defaultValue="catalogs">
        <Tabs.List>
          <Tabs.Tab value="catalogs">Catalogs</Tabs.Tab>
          <Tabs.Tab value="checkpoints">Checkpoints</Tabs.Tab>
          <Tabs.Tab value="loras">LoRAs</Tabs.Tab>
          <Tabs.Tab value="exports">Export profiles</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="catalogs" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Select data={CATALOGS} value={catalogId} onChange={(value) => setCatalogId(value ?? "asset-types")} />
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => catalogAction.run().catch(() => undefined)}>
                    Load
                  </Button>
                  <Button size="xs" onClick={() => saveCatalogAction.run().catch(() => undefined)}>
                    Save
                  </Button>
                </Group>
              </Group>
              {catalogStatus && (
                <Text size="xs" c="dimmed">
                  {catalogStatus}
                </Text>
              )}
              {(catalogAction.error || saveCatalogAction.error) && (
                <Text size="xs" c="red">
                  {catalogAction.error || saveCatalogAction.error}
                </Text>
              )}
              <Textarea
                minRows={12}
                value={catalogJson}
                onChange={(event) => setCatalogJson(event.currentTarget.value)}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="checkpoints" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Select
                    placeholder="Select checkpoint"
                    data={checkpointList.map((c) => ({ value: c.id, label: `${c.name} (${c.id})` }))}
                    value={selectedCheckpointId}
                    onChange={(value) => {
                      const id = value ?? "";
                      setSelectedCheckpointId(id);
                      if (id) loadCheckpointAction.run(id).catch(() => undefined);
                    }}
                  />
                  <Button size="xs" variant="light" onClick={() => checkpointsAction.run().catch(() => undefined)}>
                    Refresh
                  </Button>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setCheckpointJson(pretty({ id: "", name: "", supportedAssetTypes: ["ui_icon"] }))}
                >
                  New
                </Button>
              </Group>
              {(checkpointsAction.error || loadCheckpointAction.error || saveCheckpointAction.error) && (
                <Text size="xs" c="red">
                  {checkpointsAction.error || loadCheckpointAction.error || saveCheckpointAction.error}
                </Text>
              )}
              <Textarea
                minRows={12}
                value={checkpointJson}
                onChange={(event) => setCheckpointJson(event.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button size="xs" onClick={() => saveCheckpointAction.run().catch(() => undefined)}>
                  Save checkpoint
                </Button>
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="loras" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Select
                  data={[
                    { value: "project", label: "Project" },
                    { value: "baseline", label: "Baseline" },
                  ]}
                  value={loraScope}
                  onChange={(value) => setLoraScope((value as "project" | "baseline") ?? "project")}
                />
                <Button size="xs" variant="light" onClick={() => loraAction.run().catch(() => undefined)}>
                  Refresh
                </Button>
              </Group>
              {loraAction.error && (
                <Text size="xs" c="red">
                  {loraAction.error}
                </Text>
              )}
              {loraList.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No LoRAs found.
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  {loraList.map((lora) => (
                    <Card key={lora.id} withBorder radius="sm" p="sm">
                      <Stack gap="xs">
                        <Text fw={600}>{lora.name}</Text>
                        <Text size="xs" c="dimmed">
                          {lora.id} · {lora.checkpointId}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant={lora.recommended ? "filled" : "light"}
                            onClick={() =>
                              (loraScope === "baseline"
                                ? updateSharedLora(lora.id, { recommended: !lora.recommended })
                                : selectedProjectId
                                  ? updateProjectLora(selectedProjectId, lora.id, { recommended: !lora.recommended })
                                  : Promise.resolve()
                              ).then(() => loraAction.run())
                            }
                          >
                            {lora.recommended ? "Recommended" : "Recommend"}
                          </Button>
                        </Group>
                        <Select
                          data={(lora.releases ?? []).map((r: any) => ({
                            value: r.id,
                            label: `${r.id} (${r.status})`,
                          }))}
                          value={lora.activeReleaseId ?? ""}
                          onChange={(value) =>
                            (loraScope === "baseline"
                              ? updateSharedLora(lora.id, { activeReleaseId: value ?? null })
                              : selectedProjectId
                                ? updateProjectLora(selectedProjectId, lora.id, { activeReleaseId: value ?? null })
                                : Promise.resolve()
                            ).then(() => loraAction.run())
                          }
                          placeholder="Active release"
                          clearable
                        />
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="exports" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Select
                    placeholder="Select profile"
                    data={exportProfiles.map((p) => ({ value: p.id, label: `${p.name} (${p.id})` }))}
                    value={selectedProfileId}
                    onChange={(value) => {
                      const id = value ?? "";
                      setSelectedProfileId(id);
                      if (id) loadProfileAction.run(id).catch(() => undefined);
                    }}
                  />
                  <Button size="xs" variant="light" onClick={() => profilesAction.run().catch(() => undefined)}>
                    Refresh
                  </Button>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setProfileJson(pretty({ name: "New profile", type: "pixi_kit", options: {} }))}
                >
                  New
                </Button>
              </Group>
              {(profilesAction.error || loadProfileAction.error || saveProfileAction.error) && (
                <Text size="xs" c="red">
                  {profilesAction.error || loadProfileAction.error || saveProfileAction.error}
                </Text>
              )}
              <Textarea
                minRows={12}
                value={profileJson}
                onChange={(event) => setProfileJson(event.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button size="xs" onClick={() => saveProfileAction.run().catch(() => undefined)}>
                  Save profile
                </Button>
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
