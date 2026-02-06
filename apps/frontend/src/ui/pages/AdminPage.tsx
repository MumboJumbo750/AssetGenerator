import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { FormBuilder } from "../components/FormBuilder";
import {
  createBaselineProfile,
  createCheckpoint,
  createExportProfile,
  getCatalog,
  getCatalogWithMeta,
  listBaselineProfiles,
  listCheckpoints,
  listExportProfiles,
  listProjectLoras,
  listSharedLoras,
  updateBaselineProfile,
  updateCatalog,
  updateCheckpoint,
  updateExportProfile,
  updateProjectLora,
  updateSharedLora,
  type BaselineProfile,
  type CheckpointRecord,
  type ExportProfile,
} from "../api";
import { useAppData } from "../context/AppDataContext";
import { useAsyncAction } from "../hooks/useAsyncAction";

const CATALOGS = [
  { value: "asset-types", label: "Asset Types" },
  { value: "styles", label: "Styles" },
  { value: "scenarios", label: "Scenarios" },
  { value: "palettes", label: "Palettes" },
  { value: "tags", label: "Tags" },
];

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCsv(value: string[] | undefined) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseKeyValueLines(lines: string) {
  const out: Record<string, unknown> = {};
  for (const line of lines.split("\n")) {
    const raw = line.trim();
    if (!raw) continue;
    const idx = raw.indexOf("=");
    if (idx <= 0) continue;
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    const parsed = Number(value);
    out[key] = Number.isFinite(parsed) && value !== "" ? parsed : value;
  }
  return out;
}

function toKeyValueLines(value: Record<string, unknown> | undefined) {
  return Object.entries(value ?? {})
    .map(([key, val]) => `${key}=${String(val ?? "")}`)
    .join("\n");
}

function defaultBaselineDraft(): Partial<BaselineProfile> {
  return {
    name: "Default baseline profile",
    version: 1,
    checkpointId: "ckpt_sd15_demo",
    global: {
      noDropShadows: true,
      background: "white_or_transparent",
      alphaEdgeClean: "required",
      allowPerspective: false,
    },
    assetTypeProfiles: {
      ui_icon: {
        lighting: "flat",
        tileableEdges: "off",
        requiredStates: ["default"],
        stateAlignment: "n/a",
        paddingPx: 2,
        promptHints: [],
        negativePromptHints: [],
      },
    },
    validatorPolicy: {
      shadowCheck: { enabled: true, threshold: 0.9 },
      backgroundCheck: { enabled: true, mode: "white_or_transparent", threshold: 0.9 },
      stateCompletenessCheck: { enabled: true, threshold: 0.95 },
      stateAlignmentCheck: { enabled: true, maxPixelDrift: 2 },
      edgeCleanlinessCheck: { enabled: true, threshold: 0.85 },
    },
    routingPolicy: {
      onPass: "auto_advance",
      onFail: "manual_review",
      onUncertain: "queue_decision_sprint",
    },
  };
}

export function AdminPage() {
  const { selectedProjectId } = useAppData();
  const [catalogId, setCatalogId] = useState("asset-types");
  const [catalogScope, setCatalogScope] = useState<"project" | "checkpoint">("project");
  const [catalogCheckpointId, setCatalogCheckpointId] = useState("");
  const [catalogResolvedScope, setCatalogResolvedScope] = useState<"project" | "checkpoint" | null>(null);
  const [catalogDraft, setCatalogDraft] = useState<Record<string, unknown>>({});
  const [catalogStatus, setCatalogStatus] = useState("");

  const [checkpointList, setCheckpointList] = useState<CheckpointRecord[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [checkpointDraft, setCheckpointDraft] = useState<Partial<CheckpointRecord>>({
    id: "",
    name: "",
    supportedAssetTypes: ["ui_icon"],
    weights: { kind: "config_relative", base: "checkpointsRoot", path: "" },
  });
  const [checkpointBasePositive, setCheckpointBasePositive] = useState("");
  const [checkpointBaseNegative, setCheckpointBaseNegative] = useState("");
  const [checkpointDefaults, setCheckpointDefaults] = useState("");

  const [exportProfiles, setExportProfiles] = useState<ExportProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileDraft, setProfileDraft] = useState<Partial<ExportProfile>>({
    name: "New profile",
    type: "pixi_kit",
    options: {},
  });
  const [baselineProfiles, setBaselineProfiles] = useState<BaselineProfile[]>([]);
  const [selectedBaselineProfileId, setSelectedBaselineProfileId] = useState("");
  const [baselineDraft, setBaselineDraft] = useState<Partial<BaselineProfile>>(defaultBaselineDraft());
  const [newAssetTypeId, setNewAssetTypeId] = useState("ui_icon");
  const [newOverrideSpecId, setNewOverrideSpecId] = useState("");

  const [loraScope, setLoraScope] = useState<"project" | "baseline">("project");
  const [loraList, setLoraList] = useState<any[]>([]);

  const catalogAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    if (catalogScope === "checkpoint") {
      if (!catalogCheckpointId) throw new Error("Select checkpoint scope target.");
      const result = await getCatalogWithMeta(selectedProjectId, catalogId, { checkpointId: catalogCheckpointId });
      setCatalogDraft(result.catalog);
      setCatalogResolvedScope(result.resolvedScope);
      setCatalogStatus(
        result.resolvedScope === "checkpoint"
          ? `Loaded checkpoint catalog (${catalogCheckpointId})`
          : `Loaded project fallback (no checkpoint catalog for ${catalogCheckpointId})`,
      );
      return;
    }
    const catalog = await getCatalog(selectedProjectId, catalogId);
    setCatalogDraft(catalog);
    setCatalogResolvedScope("project");
    setCatalogStatus("Loaded project catalog");
  });

  const saveCatalogAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    if (catalogScope === "checkpoint") {
      if (!catalogCheckpointId) throw new Error("Select checkpoint scope target.");
      await updateCatalog(selectedProjectId, catalogId, catalogDraft, { checkpointId: catalogCheckpointId });
      setCatalogResolvedScope("checkpoint");
      setCatalogStatus(`Saved checkpoint catalog (${catalogCheckpointId})`);
      return;
    }
    await updateCatalog(selectedProjectId, catalogId, catalogDraft);
    setCatalogResolvedScope("project");
    setCatalogStatus("Saved project catalog");
  });

  const seedCheckpointCatalogAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    if (!catalogCheckpointId) throw new Error("Select checkpoint scope target.");
    const projectCatalog = await getCatalog(selectedProjectId, catalogId);
    await updateCatalog(selectedProjectId, catalogId, projectCatalog, { checkpointId: catalogCheckpointId });
    setCatalogDraft(projectCatalog);
    setCatalogResolvedScope("checkpoint");
    setCatalogStatus(`Created checkpoint catalog from project default (${catalogCheckpointId})`);
  });

  const checkpointsAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const result = await listCheckpoints(selectedProjectId);
    setCheckpointList(result.checkpoints ?? []);
    setCatalogCheckpointId((prev) => prev || result.checkpoints?.[0]?.id || "");
  });

  const profilesAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const result = await listExportProfiles(selectedProjectId);
    setExportProfiles(result.profiles ?? []);
  });

  const baselineProfilesAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    const result = await listBaselineProfiles(selectedProjectId);
    setBaselineProfiles(result.profiles ?? []);
  });

  const loraAction = useAsyncAction(async () => {
    if (!selectedProjectId && loraScope === "project") return;
    const result = loraScope === "baseline" ? await listSharedLoras() : await listProjectLoras(selectedProjectId);
    setLoraList(result.loras ?? []);
  });

  useEffect(() => {
    if (!selectedProjectId) return;
    catalogAction.run().catch(() => undefined);
    checkpointsAction.run().catch(() => undefined);
    profilesAction.run().catch(() => undefined);
    baselineProfilesAction.run().catch(() => undefined);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    catalogAction.run().catch(() => undefined);
  }, [catalogId, catalogScope, catalogCheckpointId, selectedProjectId]);

  useEffect(() => {
    loraAction.run().catch(() => undefined);
  }, [loraScope, selectedProjectId]);

  useEffect(() => {
    const selected = checkpointList.find((item) => item.id === selectedCheckpointId);
    if (!selected) return;
    setCheckpointDraft(selected);
    setCheckpointBasePositive(String(selected.promptTemplates?.basePositive ?? ""));
    setCheckpointBaseNegative(String(selected.promptTemplates?.baseNegative ?? ""));
    setCheckpointDefaults(toKeyValueLines(selected.defaultGenerationParams));
  }, [checkpointList, selectedCheckpointId]);

  useEffect(() => {
    const selected = exportProfiles.find((item) => item.id === selectedProfileId);
    if (!selected) return;
    setProfileDraft(selected);
  }, [exportProfiles, selectedProfileId]);

  useEffect(() => {
    const selected = baselineProfiles.find((item) => item.id === selectedBaselineProfileId);
    if (!selected) return;
    setBaselineDraft(selected);
  }, [baselineProfiles, selectedBaselineProfileId]);

  function updateCatalogArray(key: string, updater: (items: any[]) => any[]) {
    setCatalogDraft((prev) => ({
      ...prev,
      [key]: updater(Array.isArray((prev as any)[key]) ? ((prev as any)[key] as any[]) : []),
    }));
  }

  const catalogAssetTypes = useMemo(() => ((catalogDraft as any).assetTypes as any[]) ?? [], [catalogDraft]);
  const catalogStyles = useMemo(() => ((catalogDraft as any).styles as any[]) ?? [], [catalogDraft]);
  const catalogScenarios = useMemo(() => ((catalogDraft as any).scenarios as any[]) ?? [], [catalogDraft]);
  const catalogPalettes = useMemo(() => ((catalogDraft as any).palettes as any[]) ?? [], [catalogDraft]);
  const catalogTagGroups = useMemo(() => ((catalogDraft as any).groups as any[]) ?? [], [catalogDraft]);

  async function saveCheckpoint() {
    if (!selectedProjectId) return;
    const payload: Partial<CheckpointRecord> = {
      ...checkpointDraft,
      promptTemplates: {
        ...(checkpointDraft.promptTemplates ?? {}),
        basePositive: checkpointBasePositive,
        baseNegative: checkpointBaseNegative,
      },
      defaultGenerationParams: parseKeyValueLines(checkpointDefaults),
      supportedAssetTypes: splitCsv(joinCsv(checkpointDraft.supportedAssetTypes)),
    };
    if (payload.id && checkpointList.some((item) => item.id === payload.id)) {
      await updateCheckpoint(selectedProjectId, payload.id, payload);
    } else {
      const created = await createCheckpoint(selectedProjectId, payload);
      setSelectedCheckpointId(created.id);
    }
    await checkpointsAction.run();
  }

  async function saveProfile() {
    if (!selectedProjectId) return;
    const payload: Partial<ExportProfile> = { ...profileDraft, options: { ...(profileDraft.options ?? {}) } };
    if (payload.id && exportProfiles.some((item) => item.id === payload.id)) {
      await updateExportProfile(selectedProjectId, payload.id, payload);
    } else {
      const created = await createExportProfile(selectedProjectId, payload);
      setSelectedProfileId(created.id);
    }
    await profilesAction.run();
  }

  async function saveBaselineProfile() {
    if (!selectedProjectId) return;
    const payload: Partial<BaselineProfile> = {
      ...baselineDraft,
      name: String(baselineDraft.name ?? "").trim() || "Default baseline profile",
      version: Number(baselineDraft.version ?? 1) || 1,
      global: baselineDraft.global,
      assetTypeProfiles: baselineDraft.assetTypeProfiles,
      validatorPolicy: baselineDraft.validatorPolicy,
      routingPolicy: baselineDraft.routingPolicy,
      specOverrides: baselineDraft.specOverrides,
    };
    if (payload.id && baselineProfiles.some((item) => item.id === payload.id)) {
      await updateBaselineProfile(selectedProjectId, payload.id, payload);
    } else {
      const created = await createBaselineProfile(selectedProjectId, payload);
      setSelectedBaselineProfileId(created.id);
    }
    await baselineProfilesAction.run();
  }

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
          <Tabs.Tab value="baseline">Baseline profiles</Tabs.Tab>
          <Tabs.Tab value="exports">Export profiles</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="catalogs" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-end">
                <SimpleGrid cols={{ base: 1, md: 3 }} style={{ flex: 1 }}>
                  <Select
                    label="Catalog"
                    data={CATALOGS}
                    value={catalogId}
                    onChange={(value) => setCatalogId(value ?? "asset-types")}
                  />
                  <Select
                    label="Scope"
                    data={[
                      { value: "project", label: "Project (default)" },
                      { value: "checkpoint", label: "Checkpoint override" },
                    ]}
                    value={catalogScope}
                    onChange={(value) => setCatalogScope((value as "project" | "checkpoint") ?? "project")}
                  />
                  <Select
                    label="Checkpoint"
                    placeholder="Select checkpoint"
                    data={checkpointList.map((item) => ({
                      value: item.id,
                      label: item.name ? `${item.name} (${item.id})` : item.id,
                    }))}
                    value={catalogCheckpointId}
                    onChange={(value) => setCatalogCheckpointId(value ?? "")}
                    disabled={catalogScope !== "checkpoint"}
                    searchable
                  />
                </SimpleGrid>
                <Group>
                  <Button size="xs" variant="light" onClick={() => catalogAction.run().catch(() => undefined)}>
                    Load
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => seedCheckpointCatalogAction.run().catch(() => undefined)}
                    disabled={catalogScope !== "checkpoint" || !catalogCheckpointId}
                  >
                    Create from project default
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => saveCatalogAction.run().catch(() => undefined)}
                    disabled={catalogScope === "checkpoint" && !catalogCheckpointId}
                  >
                    Save
                  </Button>
                </Group>
              </Group>
              <Group justify="space-between">
                {catalogStatus ? (
                  <Text size="xs" c="dimmed">
                    {catalogStatus}
                  </Text>
                ) : (
                  <div />
                )}
                {catalogScope === "checkpoint" && (
                  <Badge color={catalogResolvedScope === "checkpoint" ? "teal" : "yellow"} variant="light">
                    {catalogResolvedScope === "checkpoint" ? "Scoped catalog loaded" : "Using project fallback"}
                  </Badge>
                )}
              </Group>

              {catalogId === "asset-types" && (
                <Stack gap="xs">
                  {catalogAssetTypes.map((item, index) => (
                    <Card key={`${item.id}-${index}`} withBorder radius="sm" p="sm">
                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <TextInput
                          label="ID"
                          value={String(item.id ?? "")}
                          onChange={(event) =>
                            updateCatalogArray("assetTypes", (items) =>
                              items.map((entry, i) =>
                                i === index ? { ...entry, id: event.currentTarget.value } : entry,
                              ),
                            )
                          }
                        />
                        <TextInput
                          label="Label"
                          value={String(item.label ?? "")}
                          onChange={(event) =>
                            updateCatalogArray("assetTypes", (items) =>
                              items.map((entry, i) =>
                                i === index ? { ...entry, label: event.currentTarget.value } : entry,
                              ),
                            )
                          }
                        />
                        <TextInput
                          label="Default tags (csv)"
                          value={joinCsv(item.defaultTags)}
                          onChange={(event) =>
                            updateCatalogArray("assetTypes", (items) =>
                              items.map((entry, i) =>
                                i === index ? { ...entry, defaultTags: splitCsv(event.currentTarget.value) } : entry,
                              ),
                            )
                          }
                        />
                        <Group>
                          <Checkbox
                            label="Requires alpha"
                            checked={Boolean(item.requiresAlpha)}
                            onChange={(event) =>
                              updateCatalogArray("assetTypes", (items) =>
                                items.map((entry, i) =>
                                  i === index ? { ...entry, requiresAlpha: event.currentTarget.checked } : entry,
                                ),
                              )
                            }
                          />
                          <Checkbox
                            label="Multi-frame"
                            checked={Boolean(item.multiFrame)}
                            onChange={(event) =>
                              updateCatalogArray("assetTypes", (items) =>
                                items.map((entry, i) =>
                                  i === index ? { ...entry, multiFrame: event.currentTarget.checked } : entry,
                                ),
                              )
                            }
                          />
                        </Group>
                        <Group justify="flex-end">
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              updateCatalogArray("assetTypes", (items) => items.filter((_, i) => i !== index))
                            }
                          >
                            Remove
                          </Button>
                        </Group>
                      </SimpleGrid>
                    </Card>
                  ))}
                  <Button
                    variant="light"
                    onClick={() =>
                      updateCatalogArray("assetTypes", (items) => [
                        ...items,
                        { id: "new_asset_type", label: "New Asset Type" },
                      ])
                    }
                  >
                    Add asset type
                  </Button>
                </Stack>
              )}

              {(catalogId === "styles" || catalogId === "scenarios") && (
                <Stack gap="xs">
                  {(catalogId === "styles" ? catalogStyles : catalogScenarios).map((item, index) => {
                    const key = catalogId === "styles" ? "styles" : "scenarios";
                    return (
                      <Card key={`${item.id}-${index}`} withBorder radius="sm" p="sm">
                        <SimpleGrid cols={{ base: 1, md: 2 }}>
                          <TextInput
                            label="ID"
                            value={String(item.id ?? "")}
                            onChange={(event) =>
                              updateCatalogArray(key, (items) =>
                                items.map((entry, i) =>
                                  i === index ? { ...entry, id: event.currentTarget.value } : entry,
                                ),
                              )
                            }
                          />
                          <TextInput
                            label="Label"
                            value={String(item.label ?? "")}
                            onChange={(event) =>
                              updateCatalogArray(key, (items) =>
                                items.map((entry, i) =>
                                  i === index ? { ...entry, label: event.currentTarget.value } : entry,
                                ),
                              )
                            }
                          />
                          <TextInput
                            label="Prompt tokens (csv)"
                            value={joinCsv(item.promptTokens)}
                            onChange={(event) =>
                              updateCatalogArray(key, (items) =>
                                items.map((entry, i) =>
                                  i === index ? { ...entry, promptTokens: splitCsv(event.currentTarget.value) } : entry,
                                ),
                              )
                            }
                          />
                          <Group justify="flex-end">
                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              onClick={() => updateCatalogArray(key, (items) => items.filter((_, i) => i !== index))}
                            >
                              Remove
                            </Button>
                          </Group>
                        </SimpleGrid>
                      </Card>
                    );
                  })}
                  <Button
                    variant="light"
                    onClick={() =>
                      updateCatalogArray(catalogId === "styles" ? "styles" : "scenarios", (items) => [
                        ...items,
                        { id: "new_id", label: "New item", promptTokens: [] },
                      ])
                    }
                  >
                    Add item
                  </Button>
                </Stack>
              )}

              {catalogId === "palettes" && (
                <Stack gap="xs">
                  {catalogPalettes.map((item, index) => (
                    <Card key={`${item.id}-${index}`} withBorder radius="sm" p="sm">
                      <SimpleGrid cols={{ base: 1, md: 2 }}>
                        <TextInput
                          label="ID"
                          value={String(item.id ?? "")}
                          onChange={(event) =>
                            updateCatalogArray("palettes", (items) =>
                              items.map((entry, i) =>
                                i === index ? { ...entry, id: event.currentTarget.value } : entry,
                              ),
                            )
                          }
                        />
                        <TextInput
                          label="Label"
                          value={String(item.label ?? "")}
                          onChange={(event) =>
                            updateCatalogArray("palettes", (items) =>
                              items.map((entry, i) =>
                                i === index ? { ...entry, label: event.currentTarget.value } : entry,
                              ),
                            )
                          }
                        />
                        <TextInput
                          label="Colors (csv)"
                          value={joinCsv(item.colors)}
                          onChange={(event) =>
                            updateCatalogArray("palettes", (items) =>
                              items.map((entry, i) =>
                                i === index ? { ...entry, colors: splitCsv(event.currentTarget.value) } : entry,
                              ),
                            )
                          }
                        />
                        <Group justify="flex-end">
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              updateCatalogArray("palettes", (items) => items.filter((_, i) => i !== index))
                            }
                          >
                            Remove
                          </Button>
                        </Group>
                      </SimpleGrid>
                    </Card>
                  ))}
                  <Button
                    variant="light"
                    onClick={() =>
                      updateCatalogArray("palettes", (items) => [
                        ...items,
                        { id: "new_palette", label: "New palette", colors: ["#FFFFFF"] },
                      ])
                    }
                  >
                    Add palette
                  </Button>
                </Stack>
              )}

              {catalogId === "tags" && (
                <Stack gap="xs">
                  {catalogTagGroups.map((group, groupIndex) => (
                    <Card key={`${group.id}-${groupIndex}`} withBorder radius="sm" p="sm">
                      <Stack gap="xs">
                        <Group grow>
                          <TextInput
                            label="Group ID"
                            value={String(group.id ?? "")}
                            onChange={(event) =>
                              updateCatalogArray("groups", (items) =>
                                items.map((entry, i) =>
                                  i === groupIndex ? { ...entry, id: event.currentTarget.value } : entry,
                                ),
                              )
                            }
                          />
                          <TextInput
                            label="Group label"
                            value={String(group.label ?? "")}
                            onChange={(event) =>
                              updateCatalogArray("groups", (items) =>
                                items.map((entry, i) =>
                                  i === groupIndex ? { ...entry, label: event.currentTarget.value } : entry,
                                ),
                              )
                            }
                          />
                          <Switch
                            label="Exclusive"
                            checked={Boolean(group.exclusive)}
                            onChange={(event) =>
                              updateCatalogArray("groups", (items) =>
                                items.map((entry, i) =>
                                  i === groupIndex ? { ...entry, exclusive: event.currentTarget.checked } : entry,
                                ),
                              )
                            }
                          />
                        </Group>
                        {((group.tags as any[]) ?? []).map((tag, tagIndex) => (
                          <Group key={`${tag.id}-${tagIndex}`} grow>
                            <TextInput
                              label="Tag ID"
                              value={String(tag.id ?? "")}
                              onChange={(event) =>
                                updateCatalogArray("groups", (items) =>
                                  items.map((entry, i) => {
                                    if (i !== groupIndex) return entry;
                                    const tags = [...((entry.tags as any[]) ?? [])];
                                    tags[tagIndex] = { ...tags[tagIndex], id: event.currentTarget.value };
                                    return { ...entry, tags };
                                  }),
                                )
                              }
                            />
                            <TextInput
                              label="Tag label"
                              value={String(tag.label ?? "")}
                              onChange={(event) =>
                                updateCatalogArray("groups", (items) =>
                                  items.map((entry, i) => {
                                    if (i !== groupIndex) return entry;
                                    const tags = [...((entry.tags as any[]) ?? [])];
                                    tags[tagIndex] = { ...tags[tagIndex], label: event.currentTarget.value };
                                    return { ...entry, tags };
                                  }),
                                )
                              }
                            />
                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              onClick={() =>
                                updateCatalogArray("groups", (items) =>
                                  items.map((entry, i) => {
                                    if (i !== groupIndex) return entry;
                                    const tags = [...((entry.tags as any[]) ?? [])].filter(
                                      (_, idx) => idx !== tagIndex,
                                    );
                                    return { ...entry, tags };
                                  }),
                                )
                              }
                            >
                              Remove tag
                            </Button>
                          </Group>
                        ))}
                        <Group>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              updateCatalogArray("groups", (items) =>
                                items.map((entry, i) =>
                                  i === groupIndex
                                    ? {
                                        ...entry,
                                        tags: [...((entry.tags as any[]) ?? []), { id: "new_tag", label: "New tag" }],
                                      }
                                    : entry,
                                ),
                              )
                            }
                          >
                            Add tag
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              updateCatalogArray("groups", (items) => items.filter((_, i) => i !== groupIndex))
                            }
                          >
                            Remove group
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                  <Button
                    variant="light"
                    onClick={() =>
                      updateCatalogArray("groups", (items) => [
                        ...items,
                        { id: "new_group", label: "New group", exclusive: false, tags: [] },
                      ])
                    }
                  >
                    Add group
                  </Button>
                </Stack>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="checkpoints" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Select
                  placeholder="Select checkpoint"
                  data={checkpointList.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))}
                  value={selectedCheckpointId}
                  onChange={(value) => setSelectedCheckpointId(value ?? "")}
                />
                <Group>
                  <Button size="xs" variant="light" onClick={() => checkpointsAction.run().catch(() => undefined)}>
                    Refresh
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => {
                      setSelectedCheckpointId("");
                      setCheckpointDraft({
                        id: "",
                        name: "",
                        supportedAssetTypes: ["ui_icon"],
                        weights: { kind: "config_relative", base: "checkpointsRoot", path: "" },
                      });
                      setCheckpointBasePositive("");
                      setCheckpointBaseNegative("");
                      setCheckpointDefaults("");
                    }}
                  >
                    New
                  </Button>
                </Group>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="ID"
                  value={String(checkpointDraft.id ?? "")}
                  onChange={(event) => setCheckpointDraft((prev) => ({ ...prev, id: event.currentTarget.value }))}
                />
                <TextInput
                  label="Name"
                  value={String(checkpointDraft.name ?? "")}
                  onChange={(event) => setCheckpointDraft((prev) => ({ ...prev, name: event.currentTarget.value }))}
                />
                <TextInput
                  label="Weights kind"
                  value={String((checkpointDraft.weights as any)?.kind ?? "config_relative")}
                  onChange={(event) =>
                    setCheckpointDraft((prev) => ({
                      ...prev,
                      weights: { ...(prev.weights as any), kind: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Weights path"
                  value={String((checkpointDraft.weights as any)?.path ?? "")}
                  onChange={(event) =>
                    setCheckpointDraft((prev) => ({
                      ...prev,
                      weights: { ...(prev.weights as any), path: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Weights base"
                  value={String((checkpointDraft.weights as any)?.base ?? "checkpointsRoot")}
                  onChange={(event) =>
                    setCheckpointDraft((prev) => ({
                      ...prev,
                      weights: { ...(prev.weights as any), base: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Supported asset types (csv)"
                  value={joinCsv(checkpointDraft.supportedAssetTypes)}
                  onChange={(event) =>
                    setCheckpointDraft((prev) => ({
                      ...prev,
                      supportedAssetTypes: splitCsv(event.currentTarget.value),
                    }))
                  }
                />
              </SimpleGrid>
              <TextInput
                label="Base positive prompt"
                value={checkpointBasePositive}
                onChange={(event) => setCheckpointBasePositive(event.currentTarget.value)}
              />
              <TextInput
                label="Base negative prompt"
                value={checkpointBaseNegative}
                onChange={(event) => setCheckpointBaseNegative(event.currentTarget.value)}
              />
              <TextInput
                label="Default params (key=value; key=value)"
                value={checkpointDefaults.replace(/\n/g, "; ")}
                onChange={(event) => setCheckpointDefaults(event.currentTarget.value.split(";").join("\n"))}
              />
              <Button onClick={() => saveCheckpoint().catch(() => undefined)}>Save checkpoint</Button>
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
              {loraList.length === 0 && (
                <Text size="sm" c="dimmed">
                  No LoRAs found.
                </Text>
              )}
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {loraList.map((lora) => (
                  <Card key={lora.id} withBorder radius="sm" p="sm">
                    <Stack gap="xs">
                      <Text fw={600}>{lora.name}</Text>
                      <Text size="xs" c="dimmed">
                        {lora.id} � {lora.checkpointId}
                      </Text>
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
                      <Select
                        data={(lora.releases ?? []).map((release: any) => ({
                          value: release.id,
                          label: `${release.id} (${release.status})`,
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
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="baseline" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Select
                  placeholder="Select baseline profile"
                  data={baselineProfiles.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))}
                  value={selectedBaselineProfileId}
                  onChange={(value) => setSelectedBaselineProfileId(value ?? "")}
                />
                <Group>
                  <Button size="xs" variant="light" onClick={() => baselineProfilesAction.run().catch(() => undefined)}>
                    Refresh
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => {
                      setSelectedBaselineProfileId("");
                      setBaselineDraft(defaultBaselineDraft());
                    }}
                  >
                    New
                  </Button>
                  <Button size="xs" onClick={() => saveBaselineProfile().catch(() => undefined)}>
                    Save
                  </Button>
                </Group>
              </Group>

              <FormBuilder
                fields={[
                  {
                    id: "baseline-name",
                    label: "Profile name",
                    type: "text",
                    value: String(baselineDraft.name ?? ""),
                    onChange: (value) => setBaselineDraft((prev) => ({ ...prev, name: value })),
                  },
                  {
                    id: "baseline-version",
                    label: "Version",
                    type: "number",
                    value: Number(baselineDraft.version ?? 1),
                    min: 1,
                    onChange: (value) => setBaselineDraft((prev) => ({ ...prev, version: Number(value ?? 1) })),
                  },
                ]}
              />

              <Card withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Text fw={600}>Global contract</Text>
                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <Switch
                      label="No drop shadows"
                      checked={Boolean(baselineDraft.global?.noDropShadows)}
                      onChange={(event) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          global: {
                            ...(prev.global ?? defaultBaselineDraft().global!),
                            noDropShadows: event.currentTarget.checked,
                          },
                        }))
                      }
                    />
                    <Switch
                      label="Allow perspective"
                      checked={Boolean(baselineDraft.global?.allowPerspective)}
                      onChange={(event) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          global: {
                            ...(prev.global ?? defaultBaselineDraft().global!),
                            allowPerspective: event.currentTarget.checked,
                          },
                        }))
                      }
                    />
                    <Select
                      label="Background"
                      data={[
                        { value: "white_or_transparent", label: "white_or_transparent" },
                        { value: "transparent_only", label: "transparent_only" },
                        { value: "white_only", label: "white_only" },
                        { value: "any", label: "any" },
                      ]}
                      value={baselineDraft.global?.background ?? "white_or_transparent"}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          global: {
                            ...(prev.global ?? defaultBaselineDraft().global!),
                            background: (value as BaselineProfile["global"]["background"]) ?? "white_or_transparent",
                          },
                        }))
                      }
                    />
                    <Select
                      label="Alpha edge clean"
                      data={[
                        { value: "required", label: "required" },
                        { value: "preferred", label: "preferred" },
                        { value: "off", label: "off" },
                      ]}
                      value={baselineDraft.global?.alphaEdgeClean ?? "required"}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          global: {
                            ...(prev.global ?? defaultBaselineDraft().global!),
                            alphaEdgeClean: (value as BaselineProfile["global"]["alphaEdgeClean"]) ?? "required",
                          },
                        }))
                      }
                    />
                  </SimpleGrid>
                </Stack>
              </Card>

              <Card withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Text fw={600}>Validator policy</Text>
                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <Switch
                      label="Shadow check enabled"
                      checked={Boolean(baselineDraft.validatorPolicy?.shadowCheck?.enabled)}
                      onChange={(event) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            shadowCheck: {
                              ...(prev.validatorPolicy?.shadowCheck ?? { enabled: true, threshold: 0.9 }),
                              enabled: event.currentTarget.checked,
                            },
                          },
                        }))
                      }
                    />
                    <NumberInput
                      label="Shadow threshold"
                      value={Number(baselineDraft.validatorPolicy?.shadowCheck?.threshold ?? 0.9)}
                      min={0}
                      max={1}
                      step={0.01}
                      decimalScale={2}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            shadowCheck: {
                              ...(prev.validatorPolicy?.shadowCheck ?? { enabled: true, threshold: 0.9 }),
                              threshold: Number(value ?? 0.9),
                            },
                          },
                        }))
                      }
                    />
                    <Switch
                      label="Background check enabled"
                      checked={Boolean(baselineDraft.validatorPolicy?.backgroundCheck?.enabled)}
                      onChange={(event) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            backgroundCheck: {
                              ...(prev.validatorPolicy?.backgroundCheck ?? {
                                enabled: true,
                                mode: "white_or_transparent",
                                threshold: 0.9,
                              }),
                              enabled: event.currentTarget.checked,
                            },
                          },
                        }))
                      }
                    />
                    <NumberInput
                      label="Background threshold"
                      value={Number(baselineDraft.validatorPolicy?.backgroundCheck?.threshold ?? 0.9)}
                      min={0}
                      max={1}
                      step={0.01}
                      decimalScale={2}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            backgroundCheck: {
                              ...(prev.validatorPolicy?.backgroundCheck ?? {
                                enabled: true,
                                mode: "white_or_transparent",
                                threshold: 0.9,
                              }),
                              threshold: Number(value ?? 0.9),
                            },
                          },
                        }))
                      }
                    />
                    <Select
                      label="Background mode"
                      data={[
                        { value: "white_or_transparent", label: "white_or_transparent" },
                        { value: "transparent_only", label: "transparent_only" },
                        { value: "white_only", label: "white_only" },
                        { value: "any", label: "any" },
                      ]}
                      value={baselineDraft.validatorPolicy?.backgroundCheck?.mode ?? "white_or_transparent"}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            backgroundCheck: {
                              ...(prev.validatorPolicy?.backgroundCheck ?? {
                                enabled: true,
                                mode: "white_or_transparent",
                                threshold: 0.9,
                              }),
                              mode:
                                (value as BaselineProfile["validatorPolicy"]["backgroundCheck"]["mode"]) ??
                                "white_or_transparent",
                            },
                          },
                        }))
                      }
                    />
                    <Switch
                      label="State completeness check enabled"
                      checked={Boolean(baselineDraft.validatorPolicy?.stateCompletenessCheck?.enabled)}
                      onChange={(event) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            stateCompletenessCheck: {
                              ...(prev.validatorPolicy?.stateCompletenessCheck ?? { enabled: true, threshold: 0.95 }),
                              enabled: event.currentTarget.checked,
                            },
                          },
                        }))
                      }
                    />
                    <NumberInput
                      label="State completeness threshold"
                      value={Number(baselineDraft.validatorPolicy?.stateCompletenessCheck?.threshold ?? 0.95)}
                      min={0}
                      max={1}
                      step={0.01}
                      decimalScale={2}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            stateCompletenessCheck: {
                              ...(prev.validatorPolicy?.stateCompletenessCheck ?? { enabled: true, threshold: 0.95 }),
                              threshold: Number(value ?? 0.95),
                            },
                          },
                        }))
                      }
                    />
                    <Switch
                      label="State alignment check enabled"
                      checked={Boolean(baselineDraft.validatorPolicy?.stateAlignmentCheck?.enabled)}
                      onChange={(event) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            stateAlignmentCheck: {
                              ...(prev.validatorPolicy?.stateAlignmentCheck ?? { enabled: true, maxPixelDrift: 2 }),
                              enabled: event.currentTarget.checked,
                            },
                          },
                        }))
                      }
                    />
                    <NumberInput
                      label="Max pixel drift"
                      value={Number(baselineDraft.validatorPolicy?.stateAlignmentCheck?.maxPixelDrift ?? 2)}
                      min={0}
                      max={64}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            stateAlignmentCheck: {
                              ...(prev.validatorPolicy?.stateAlignmentCheck ?? { enabled: true, maxPixelDrift: 2 }),
                              maxPixelDrift: Number(value ?? 2),
                            },
                          },
                        }))
                      }
                    />
                    <Switch
                      label="Edge cleanliness check enabled"
                      checked={Boolean(baselineDraft.validatorPolicy?.edgeCleanlinessCheck?.enabled)}
                      onChange={(event) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            edgeCleanlinessCheck: {
                              ...(prev.validatorPolicy?.edgeCleanlinessCheck ?? { enabled: true, threshold: 0.85 }),
                              enabled: event.currentTarget.checked,
                            },
                          },
                        }))
                      }
                    />
                    <NumberInput
                      label="Edge cleanliness threshold"
                      value={Number(baselineDraft.validatorPolicy?.edgeCleanlinessCheck?.threshold ?? 0.85)}
                      min={0}
                      max={1}
                      step={0.01}
                      decimalScale={2}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          validatorPolicy: {
                            ...(prev.validatorPolicy ?? defaultBaselineDraft().validatorPolicy!),
                            edgeCleanlinessCheck: {
                              ...(prev.validatorPolicy?.edgeCleanlinessCheck ?? { enabled: true, threshold: 0.85 }),
                              threshold: Number(value ?? 0.85),
                            },
                          },
                        }))
                      }
                    />
                  </SimpleGrid>
                </Stack>
              </Card>

              <Card withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Text fw={600}>Routing policy</Text>
                  <SimpleGrid cols={{ base: 1, md: 3 }}>
                    <Select
                      label="On pass"
                      data={[
                        { value: "auto_advance", label: "auto_advance" },
                        { value: "manual_review", label: "manual_review" },
                        { value: "queue_decision_sprint", label: "queue_decision_sprint" },
                      ]}
                      value={baselineDraft.routingPolicy?.onPass ?? "auto_advance"}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          routingPolicy: {
                            ...(prev.routingPolicy ?? defaultBaselineDraft().routingPolicy!),
                            onPass: (value as BaselineProfile["routingPolicy"]["onPass"]) ?? "auto_advance",
                          },
                        }))
                      }
                    />
                    <Select
                      label="On fail"
                      data={[
                        { value: "auto_regenerate", label: "auto_regenerate" },
                        { value: "manual_review", label: "manual_review" },
                        { value: "queue_decision_sprint", label: "queue_decision_sprint" },
                        { value: "reject", label: "reject" },
                      ]}
                      value={baselineDraft.routingPolicy?.onFail ?? "manual_review"}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          routingPolicy: {
                            ...(prev.routingPolicy ?? defaultBaselineDraft().routingPolicy!),
                            onFail: (value as BaselineProfile["routingPolicy"]["onFail"]) ?? "manual_review",
                          },
                        }))
                      }
                    />
                    <Select
                      label="On uncertain"
                      data={[
                        { value: "queue_decision_sprint", label: "queue_decision_sprint" },
                        { value: "manual_review", label: "manual_review" },
                        { value: "auto_regenerate", label: "auto_regenerate" },
                      ]}
                      value={baselineDraft.routingPolicy?.onUncertain ?? "queue_decision_sprint"}
                      onChange={(value) =>
                        setBaselineDraft((prev) => ({
                          ...prev,
                          routingPolicy: {
                            ...(prev.routingPolicy ?? defaultBaselineDraft().routingPolicy!),
                            onUncertain:
                              (value as BaselineProfile["routingPolicy"]["onUncertain"]) ?? "queue_decision_sprint",
                          },
                        }))
                      }
                    />
                  </SimpleGrid>
                </Stack>
              </Card>

              <Card withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={600}>Asset type contracts</Text>
                    <Group>
                      <TextInput
                        placeholder="asset type id"
                        value={newAssetTypeId}
                        onChange={(event) => setNewAssetTypeId(event.currentTarget.value)}
                      />
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() =>
                          setBaselineDraft((prev) => ({
                            ...prev,
                            assetTypeProfiles: {
                              ...(prev.assetTypeProfiles ?? {}),
                              [newAssetTypeId.trim() || "new_asset_type"]: {
                                lighting: "flat",
                                tileableEdges: "off",
                                requiredStates: ["default"],
                                stateAlignment: "n/a",
                                paddingPx: 2,
                                promptHints: [],
                                negativePromptHints: [],
                              },
                            },
                          }))
                        }
                      >
                        Add type
                      </Button>
                    </Group>
                  </Group>
                  {Object.entries(baselineDraft.assetTypeProfiles ?? {}).map(([assetTypeId, profile]) => (
                    <Card key={assetTypeId} withBorder radius="sm" p="sm">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text fw={600}>{assetTypeId}</Text>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              setBaselineDraft((prev) => {
                                const next = { ...(prev.assetTypeProfiles ?? {}) };
                                delete next[assetTypeId];
                                return { ...prev, assetTypeProfiles: next };
                              })
                            }
                          >
                            Remove
                          </Button>
                        </Group>
                        <SimpleGrid cols={{ base: 1, md: 3 }}>
                          <Select
                            label="Lighting"
                            data={[
                              { value: "flat", label: "flat" },
                              { value: "soft", label: "soft" },
                              { value: "dramatic", label: "dramatic" },
                              { value: "any", label: "any" },
                            ]}
                            value={profile.lighting}
                            onChange={(value) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                assetTypeProfiles: {
                                  ...(prev.assetTypeProfiles ?? {}),
                                  [assetTypeId]: {
                                    ...profile,
                                    lighting: (value as typeof profile.lighting) ?? "flat",
                                  },
                                },
                              }))
                            }
                          />
                          <Select
                            label="Tileable edges"
                            data={[
                              { value: "required", label: "required" },
                              { value: "optional", label: "optional" },
                              { value: "off", label: "off" },
                            ]}
                            value={profile.tileableEdges}
                            onChange={(value) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                assetTypeProfiles: {
                                  ...(prev.assetTypeProfiles ?? {}),
                                  [assetTypeId]: {
                                    ...profile,
                                    tileableEdges: (value as typeof profile.tileableEdges) ?? "off",
                                  },
                                },
                              }))
                            }
                          />
                          <Select
                            label="State alignment"
                            data={[
                              { value: "exact", label: "exact" },
                              { value: "aligned", label: "aligned" },
                              { value: "n/a", label: "n/a" },
                            ]}
                            value={profile.stateAlignment}
                            onChange={(value) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                assetTypeProfiles: {
                                  ...(prev.assetTypeProfiles ?? {}),
                                  [assetTypeId]: {
                                    ...profile,
                                    stateAlignment: (value as typeof profile.stateAlignment) ?? "n/a",
                                  },
                                },
                              }))
                            }
                          />
                          <NumberInput
                            label="Padding px"
                            value={Number(profile.paddingPx ?? 2)}
                            min={0}
                            max={256}
                            onChange={(value) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                assetTypeProfiles: {
                                  ...(prev.assetTypeProfiles ?? {}),
                                  [assetTypeId]: {
                                    ...profile,
                                    paddingPx: Number(value ?? 2),
                                  },
                                },
                              }))
                            }
                          />
                          <TextInput
                            label="Required states (csv)"
                            value={joinCsv(profile.requiredStates)}
                            onChange={(event) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                assetTypeProfiles: {
                                  ...(prev.assetTypeProfiles ?? {}),
                                  [assetTypeId]: {
                                    ...profile,
                                    requiredStates: splitCsv(
                                      event.currentTarget.value,
                                    ) as typeof profile.requiredStates,
                                  },
                                },
                              }))
                            }
                          />
                          <TextInput
                            label="Prompt hints (csv)"
                            value={joinCsv(profile.promptHints)}
                            onChange={(event) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                assetTypeProfiles: {
                                  ...(prev.assetTypeProfiles ?? {}),
                                  [assetTypeId]: {
                                    ...profile,
                                    promptHints: splitCsv(event.currentTarget.value),
                                  },
                                },
                              }))
                            }
                          />
                          <TextInput
                            label="Negative hints (csv)"
                            value={joinCsv(profile.negativePromptHints)}
                            onChange={(event) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                assetTypeProfiles: {
                                  ...(prev.assetTypeProfiles ?? {}),
                                  [assetTypeId]: {
                                    ...profile,
                                    negativePromptHints: splitCsv(event.currentTarget.value),
                                  },
                                },
                              }))
                            }
                          />
                        </SimpleGrid>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Card>

              <Card withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={600}>Spec override policies</Text>
                    <Group>
                      <TextInput
                        placeholder="spec id"
                        value={newOverrideSpecId}
                        onChange={(event) => setNewOverrideSpecId(event.currentTarget.value)}
                      />
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          const key = newOverrideSpecId.trim();
                          if (!key) return;
                          setBaselineDraft((prev) => ({
                            ...prev,
                            specOverrides: {
                              ...(prev.specOverrides ?? {}),
                              [key]: {
                                reason: "Manual override",
                                global: {},
                              },
                            },
                          }));
                          setNewOverrideSpecId("");
                        }}
                      >
                        Add override
                      </Button>
                    </Group>
                  </Group>
                  {Object.entries(baselineDraft.specOverrides ?? {}).map(([specId, override]) => (
                    <Card key={specId} withBorder radius="sm" p="sm">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text fw={600}>{specId}</Text>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            onClick={() =>
                              setBaselineDraft((prev) => {
                                const next = { ...(prev.specOverrides ?? {}) };
                                delete next[specId];
                                return { ...prev, specOverrides: next };
                              })
                            }
                          >
                            Remove
                          </Button>
                        </Group>
                        <TextInput
                          label="Reason"
                          value={String(override.reason ?? "")}
                          onChange={(event) =>
                            setBaselineDraft((prev) => ({
                              ...prev,
                              specOverrides: {
                                ...(prev.specOverrides ?? {}),
                                [specId]: {
                                  ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                  reason: event.currentTarget.value,
                                },
                              },
                            }))
                          }
                        />
                        <SimpleGrid cols={{ base: 1, md: 2 }}>
                          <Switch
                            label="No drop shadows override"
                            checked={Boolean(override.global?.noDropShadows)}
                            onChange={(event) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                specOverrides: {
                                  ...(prev.specOverrides ?? {}),
                                  [specId]: {
                                    ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                    global: {
                                      ...((prev.specOverrides?.[specId] as any)?.global ?? {}),
                                      noDropShadows: event.currentTarget.checked,
                                    },
                                  },
                                },
                              }))
                            }
                          />
                          <Switch
                            label="Allow perspective override"
                            checked={Boolean(override.global?.allowPerspective)}
                            onChange={(event) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                specOverrides: {
                                  ...(prev.specOverrides ?? {}),
                                  [specId]: {
                                    ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                    global: {
                                      ...((prev.specOverrides?.[specId] as any)?.global ?? {}),
                                      allowPerspective: event.currentTarget.checked,
                                    },
                                  },
                                },
                              }))
                            }
                          />
                          <Select
                            label="Background override"
                            data={[
                              { value: "white_or_transparent", label: "white_or_transparent" },
                              { value: "transparent_only", label: "transparent_only" },
                              { value: "white_only", label: "white_only" },
                              { value: "any", label: "any" },
                            ]}
                            value={override.global?.background ?? "white_or_transparent"}
                            onChange={(value) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                specOverrides: {
                                  ...(prev.specOverrides ?? {}),
                                  [specId]: {
                                    ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                    global: {
                                      ...((prev.specOverrides?.[specId] as any)?.global ?? {}),
                                      background:
                                        (value as "white_or_transparent" | "transparent_only" | "white_only" | "any") ??
                                        "white_or_transparent",
                                    },
                                  },
                                },
                              }))
                            }
                          />
                          <Select
                            label="Alpha edge clean override"
                            data={[
                              { value: "required", label: "required" },
                              { value: "preferred", label: "preferred" },
                              { value: "off", label: "off" },
                            ]}
                            value={override.global?.alphaEdgeClean ?? "required"}
                            onChange={(value) =>
                              setBaselineDraft((prev) => ({
                                ...prev,
                                specOverrides: {
                                  ...(prev.specOverrides ?? {}),
                                  [specId]: {
                                    ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                    global: {
                                      ...((prev.specOverrides?.[specId] as any)?.global ?? {}),
                                      alphaEdgeClean: (value as "required" | "preferred" | "off") ?? "required",
                                    },
                                  },
                                },
                              }))
                            }
                          />
                        </SimpleGrid>
                        <Card withBorder radius="sm" p="sm">
                          <Stack gap="xs">
                            <Text fw={600} size="sm">
                              Asset type profile override
                            </Text>
                            <SimpleGrid cols={{ base: 1, md: 3 }}>
                              <Select
                                label="Lighting"
                                data={[
                                  { value: "flat", label: "flat" },
                                  { value: "soft", label: "soft" },
                                  { value: "dramatic", label: "dramatic" },
                                  { value: "any", label: "any" },
                                ]}
                                value={override.assetTypeProfile?.lighting ?? "flat"}
                                onChange={(value) =>
                                  setBaselineDraft((prev) => ({
                                    ...prev,
                                    specOverrides: {
                                      ...(prev.specOverrides ?? {}),
                                      [specId]: {
                                        ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                        assetTypeProfile: {
                                          ...(prev.specOverrides?.[specId]?.assetTypeProfile ?? {
                                            lighting: "flat",
                                            tileableEdges: "off",
                                            requiredStates: ["default"],
                                            stateAlignment: "n/a",
                                            paddingPx: 2,
                                            promptHints: [],
                                            negativePromptHints: [],
                                          }),
                                          lighting: (value as "flat" | "soft" | "dramatic" | "any") ?? "flat",
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                              <Select
                                label="Tileable edges"
                                data={[
                                  { value: "required", label: "required" },
                                  { value: "optional", label: "optional" },
                                  { value: "off", label: "off" },
                                ]}
                                value={override.assetTypeProfile?.tileableEdges ?? "off"}
                                onChange={(value) =>
                                  setBaselineDraft((prev) => ({
                                    ...prev,
                                    specOverrides: {
                                      ...(prev.specOverrides ?? {}),
                                      [specId]: {
                                        ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                        assetTypeProfile: {
                                          ...(prev.specOverrides?.[specId]?.assetTypeProfile ?? {
                                            lighting: "flat",
                                            tileableEdges: "off",
                                            requiredStates: ["default"],
                                            stateAlignment: "n/a",
                                            paddingPx: 2,
                                            promptHints: [],
                                            negativePromptHints: [],
                                          }),
                                          tileableEdges: (value as "required" | "optional" | "off") ?? "off",
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                              <Select
                                label="State alignment"
                                data={[
                                  { value: "exact", label: "exact" },
                                  { value: "aligned", label: "aligned" },
                                  { value: "n/a", label: "n/a" },
                                ]}
                                value={override.assetTypeProfile?.stateAlignment ?? "n/a"}
                                onChange={(value) =>
                                  setBaselineDraft((prev) => ({
                                    ...prev,
                                    specOverrides: {
                                      ...(prev.specOverrides ?? {}),
                                      [specId]: {
                                        ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                        assetTypeProfile: {
                                          ...(prev.specOverrides?.[specId]?.assetTypeProfile ?? {
                                            lighting: "flat",
                                            tileableEdges: "off",
                                            requiredStates: ["default"],
                                            stateAlignment: "n/a",
                                            paddingPx: 2,
                                            promptHints: [],
                                            negativePromptHints: [],
                                          }),
                                          stateAlignment: (value as "exact" | "aligned" | "n/a") ?? "n/a",
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                              <NumberInput
                                label="Padding px"
                                min={0}
                                max={256}
                                value={Number(override.assetTypeProfile?.paddingPx ?? 2)}
                                onChange={(value) =>
                                  setBaselineDraft((prev) => ({
                                    ...prev,
                                    specOverrides: {
                                      ...(prev.specOverrides ?? {}),
                                      [specId]: {
                                        ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                        assetTypeProfile: {
                                          ...(prev.specOverrides?.[specId]?.assetTypeProfile ?? {
                                            lighting: "flat",
                                            tileableEdges: "off",
                                            requiredStates: ["default"],
                                            stateAlignment: "n/a",
                                            paddingPx: 2,
                                            promptHints: [],
                                            negativePromptHints: [],
                                          }),
                                          paddingPx: Number(value ?? 2),
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                              <TextInput
                                label="Required states (csv)"
                                value={joinCsv(override.assetTypeProfile?.requiredStates)}
                                onChange={(event) =>
                                  setBaselineDraft((prev) => ({
                                    ...prev,
                                    specOverrides: {
                                      ...(prev.specOverrides ?? {}),
                                      [specId]: {
                                        ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                        assetTypeProfile: {
                                          ...(prev.specOverrides?.[specId]?.assetTypeProfile ?? {
                                            lighting: "flat",
                                            tileableEdges: "off",
                                            requiredStates: ["default"],
                                            stateAlignment: "n/a",
                                            paddingPx: 2,
                                            promptHints: [],
                                            negativePromptHints: [],
                                          }),
                                          requiredStates: splitCsv(event.currentTarget.value) as Array<
                                            | "default"
                                            | "hover"
                                            | "pressed"
                                            | "disabled"
                                            | "open"
                                            | "focused"
                                            | "selected"
                                            | "active"
                                            | "checked"
                                            | "unchecked"
                                          >,
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                              <TextInput
                                label="Prompt hints (csv)"
                                value={joinCsv(override.assetTypeProfile?.promptHints)}
                                onChange={(event) =>
                                  setBaselineDraft((prev) => ({
                                    ...prev,
                                    specOverrides: {
                                      ...(prev.specOverrides ?? {}),
                                      [specId]: {
                                        ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                        assetTypeProfile: {
                                          ...(prev.specOverrides?.[specId]?.assetTypeProfile ?? {
                                            lighting: "flat",
                                            tileableEdges: "off",
                                            requiredStates: ["default"],
                                            stateAlignment: "n/a",
                                            paddingPx: 2,
                                            promptHints: [],
                                            negativePromptHints: [],
                                          }),
                                          promptHints: splitCsv(event.currentTarget.value),
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                              <TextInput
                                label="Negative hints (csv)"
                                value={joinCsv(override.assetTypeProfile?.negativePromptHints)}
                                onChange={(event) =>
                                  setBaselineDraft((prev) => ({
                                    ...prev,
                                    specOverrides: {
                                      ...(prev.specOverrides ?? {}),
                                      [specId]: {
                                        ...(prev.specOverrides?.[specId] ?? { reason: "" }),
                                        assetTypeProfile: {
                                          ...(prev.specOverrides?.[specId]?.assetTypeProfile ?? {
                                            lighting: "flat",
                                            tileableEdges: "off",
                                            requiredStates: ["default"],
                                            stateAlignment: "n/a",
                                            paddingPx: 2,
                                            promptHints: [],
                                            negativePromptHints: [],
                                          }),
                                          negativePromptHints: splitCsv(event.currentTarget.value),
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                            </SimpleGrid>
                          </Stack>
                        </Card>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Card>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="exports" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Select
                  placeholder="Select profile"
                  data={exportProfiles.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))}
                  value={selectedProfileId}
                  onChange={(value) => setSelectedProfileId(value ?? "")}
                />
                <Group>
                  <Button size="xs" variant="light" onClick={() => profilesAction.run().catch(() => undefined)}>
                    Refresh
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => {
                      setSelectedProfileId("");
                      setProfileDraft({ name: "New profile", type: "pixi_kit", options: {} });
                    }}
                  >
                    New
                  </Button>
                </Group>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="Name"
                  value={String(profileDraft.name ?? "")}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, name: event.currentTarget.value }))}
                />
                <Select
                  label="Type"
                  data={[{ value: "pixi_kit", label: "pixi_kit" }]}
                  value={String(profileDraft.type ?? "pixi_kit")}
                  onChange={(value) => setProfileDraft((prev) => ({ ...prev, type: (value as any) ?? "pixi_kit" }))}
                />
                <NumberInput
                  label="Scale"
                  value={Number((profileDraft.options as any)?.scale ?? 1)}
                  onChange={(value) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      options: { ...(prev.options as any), scale: Number(value ?? 1) },
                    }))
                  }
                  min={0.1}
                  step={0.1}
                  decimalScale={2}
                />
                <NumberInput
                  label="Padding"
                  value={Number((profileDraft.options as any)?.padding ?? 0)}
                  onChange={(value) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      options: { ...(prev.options as any), padding: Number(value ?? 0) },
                    }))
                  }
                  min={0}
                />
                <Switch
                  label="Trim"
                  checked={Boolean((profileDraft.options as any)?.trim)}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      options: { ...(prev.options as any), trim: event.currentTarget.checked },
                    }))
                  }
                />
                <TextInput
                  label="Name prefix"
                  value={String((profileDraft.options as any)?.namePrefix ?? "")}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      options: { ...(prev.options as any), namePrefix: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Name suffix"
                  value={String((profileDraft.options as any)?.nameSuffix ?? "")}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      options: { ...(prev.options as any), nameSuffix: event.currentTarget.value },
                    }))
                  }
                />
              </SimpleGrid>
              <Button onClick={() => saveProfile().catch(() => undefined)}>Save profile</Button>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
