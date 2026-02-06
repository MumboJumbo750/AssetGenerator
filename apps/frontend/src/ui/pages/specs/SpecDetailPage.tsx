import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";

import { useAppData } from "../../context/AppDataContext";
import type { AssetSpec, CheckpointRecord } from "../../api";
import { getSpec, listCheckpoints, updateSpec } from "../../api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function statusColor(s?: string) {
  if (s === "ready") return "green";
  if (s === "deprecated") return "red";
  return "yellow";
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function SpecDetailPage() {
  const { specId } = useParams<{ specId: string }>();
  const { selectedProjectId, refreshProjectData } = useAppData();
  const navigate = useNavigate();

  const [spec, setSpec] = useState<AssetSpec | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  /* ---- draft state mirrors the editable fields ---- */
  const [draft, setDraft] = useState<Partial<AssetSpec>>({});

  const loadData = useCallback(async () => {
    if (!selectedProjectId || !specId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([
        getSpec(selectedProjectId, specId),
        listCheckpoints(selectedProjectId),
      ]);
      setSpec(s);
      setCheckpoints(c.checkpoints);
      setDraft({});
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, specId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ---- patch helper: merges into draft ---- */
  function patch(field: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }
  function patchNested(field: keyof AssetSpec, sub: string, value: unknown) {
    setDraft((prev) => {
      const existing = (prev[field] ?? (spec as any)?.[field]) as Record<string, unknown> | undefined;
      return { ...prev, [field]: { ...existing, [sub]: value } };
    });
    setDirty(true);
  }

  /* ---- save ---- */
  async function handleSave() {
    if (!selectedProjectId || !specId || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSpec(selectedProjectId, specId, draft);
      setSpec(updated);
      setDraft({});
      setDirty(false);
      await refreshProjectData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  /* ---- effective value: draft overrides spec ---- */
  function val<K extends keyof AssetSpec>(key: K): AssetSpec[K] | undefined {
    return (key in draft ? draft[key] : spec?.[key]) as AssetSpec[K] | undefined;
  }
  function nestedVal<K extends keyof AssetSpec>(key: K, sub: string): unknown {
    const obj = (key in draft ? draft[key] : spec?.[key]) as Record<string, unknown> | undefined;
    return obj?.[sub];
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  if (!selectedProjectId) {
    return <Text c="dimmed">Select a project first.</Text>;
  }

  if (loading) {
    return (
      <Stack align="center" pt="xl">
        <Loader />
        <Text c="dimmed">Loading spec…</Text>
      </Stack>
    );
  }

  if (error && !spec) {
    return (
      <Card withBorder radius="md" p="md" bg="red.9">
        <Text c="white" fw={600}>Error</Text>
        <Text c="white" size="sm">{error}</Text>
        <Button mt="sm" variant="white" color="red" onClick={() => navigate(-1)}>Back</Button>
      </Card>
    );
  }

  if (!spec) {
    return <Text c="dimmed">Spec not found.</Text>;
  }

  const checkpointOptions = checkpoints.map((c) => ({ value: c.id, label: `${c.name} (${c.id})` }));

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Group gap="xs" align="baseline">
            <Title order={3}>{spec.title}</Title>
            <Badge color={statusColor(val("status"))} variant="light">{val("status") ?? "draft"}</Badge>
          </Group>
          <Text size="sm" c="dimmed">{spec.id} · {spec.assetType} · {spec.style}/{spec.scenario}</Text>
        </div>
        <Group>
          <Button variant="subtle" onClick={() => navigate(-1)}>Back</Button>
          <Button loading={saving} disabled={!dirty} onClick={handleSave}>Save changes</Button>
        </Group>
      </Group>

      {error && (
        <Card withBorder radius="md" p="sm" bg="red.9">
          <Text c="white" size="sm">{error}</Text>
        </Card>
      )}

      <Tabs defaultValue="general">
        <Tabs.List>
          <Tabs.Tab value="general">General</Tabs.Tab>
          <Tabs.Tab value="prompt">Prompt Policy</Tabs.Tab>
          <Tabs.Tab value="quality">Quality Contract</Tabs.Tab>
          <Tabs.Tab value="lora">LoRA Policy</Tabs.Tab>
          <Tabs.Tab value="seed">Seed Policy</Tabs.Tab>
          <Tabs.Tab value="entity">Entity &amp; Style</Tabs.Tab>
        </Tabs.List>

        {/* ──────────── General ──────────── */}
        <Tabs.Panel value="general" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="md">
              <SimpleGrid cols={2}>
                <TextInput
                  label="Title"
                  value={(val("title") as string) ?? ""}
                  onChange={(e) => patch("title", e.currentTarget.value)}
                />
                <Select
                  label="Status"
                  data={[
                    { value: "draft", label: "Draft" },
                    { value: "ready", label: "Ready" },
                    { value: "deprecated", label: "Deprecated" },
                  ]}
                  value={(val("status") as string) ?? "draft"}
                  onChange={(v) => patch("status", v)}
                />
              </SimpleGrid>

              <SimpleGrid cols={2}>
                <Select
                  label="Checkpoint"
                  data={checkpointOptions}
                  value={(val("checkpointId") as string) ?? ""}
                  onChange={(v) => patch("checkpointId", v)}
                  searchable
                  clearable
                />
                <TextInput
                  label="Checkpoint Profile ID"
                  value={(val("checkpointProfileId") as string) ?? ""}
                  onChange={(e) => patch("checkpointProfileId", e.currentTarget.value)}
                  placeholder="e.g. copax_sdxl_v1"
                />
              </SimpleGrid>

              <SimpleGrid cols={2}>
                <NumberInput
                  label="Checkpoint Profile Version"
                  value={(val("checkpointProfileVersion") as number) ?? undefined}
                  onChange={(v) => patch("checkpointProfileVersion", v)}
                  min={1}
                />
                <TextInput
                  label="Baseline Profile ID"
                  value={(val("baselineProfileId") as string) ?? ""}
                  onChange={(e) => patch("baselineProfileId", e.currentTarget.value)}
                />
              </SimpleGrid>

              <Divider label="Prompt" />
              <Textarea
                label="Positive prompt"
                value={(val("prompt") as any)?.positive ?? spec.prompt.positive}
                onChange={(e) => patchNested("prompt", "positive", e.currentTarget.value)}
                autosize
                minRows={2}
              />
              <Textarea
                label="Negative prompt"
                value={(val("prompt") as any)?.negative ?? spec.prompt.negative}
                onChange={(e) => patchNested("prompt", "negative", e.currentTarget.value)}
                autosize
                minRows={2}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* ──────────── Prompt Policy ──────────── */}
        <Tabs.Panel value="prompt" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="md">
              <Text fw={600}>Prompt Policy</Text>
              <Text size="sm" c="dimmed">
                Controls how the prompt compiler assembles the final prompt from checkpoint profile, tags, and spec overrides.
              </Text>
              <SimpleGrid cols={2}>
                <Select
                  label="Compile Mode"
                  data={[
                    { value: "checkpoint_profile_default", label: "Checkpoint Profile Default" },
                    { value: "spec_override", label: "Spec Override" },
                  ]}
                  value={(nestedVal("promptPolicy", "compileMode") as string) ?? ""}
                  onChange={(v) => patchNested("promptPolicy", "compileMode", v)}
                  clearable
                />
                <Select
                  label="Tag Order Mode"
                  data={[
                    { value: "checkpoint_default", label: "Checkpoint Default" },
                    { value: "explicit", label: "Explicit" },
                  ]}
                  value={(nestedVal("promptPolicy", "tagOrderMode") as string) ?? ""}
                  onChange={(v) => patchNested("promptPolicy", "tagOrderMode", v)}
                  clearable
                />
              </SimpleGrid>
              <TextInput
                label="Tag Order (comma-separated)"
                placeholder="e.g. style, scenario, subject"
                value={((nestedVal("promptPolicy", "tagOrder") as string[]) ?? []).join(", ")}
                onChange={(e) => {
                  const tags = e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean);
                  patchNested("promptPolicy", "tagOrder", tags);
                }}
              />
              <TextInput
                label="Prompt Preset ID"
                value={(nestedVal("promptPolicy", "promptPresetId") as string) ?? ""}
                onChange={(e) => patchNested("promptPolicy", "promptPresetId", e.currentTarget.value)}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* ──────────── Quality Contract ──────────── */}
        <Tabs.Panel value="quality" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="md">
              <Text fw={600}>Quality Contract</Text>
              <Text size="sm" c="dimmed">
                Defines the quality expectations validators check against during generation review.
              </Text>
              <SimpleGrid cols={2}>
                <Select
                  label="Background Policy"
                  data={[
                    { value: "white_or_transparent", label: "White or Transparent" },
                    { value: "transparent_only", label: "Transparent Only" },
                    { value: "white_only", label: "White Only" },
                    { value: "any", label: "Any" },
                  ]}
                  value={(nestedVal("qualityContract", "backgroundPolicy") as string) ?? ""}
                  onChange={(v) => patchNested("qualityContract", "backgroundPolicy", v)}
                  clearable
                />
                <Select
                  label="Perspective Mode"
                  data={[
                    { value: "strict", label: "Strict" },
                    { value: "allow_minor", label: "Allow Minor" },
                    { value: "any", label: "Any" },
                  ]}
                  value={(nestedVal("qualityContract", "perspectiveMode") as string) ?? ""}
                  onChange={(v) => patchNested("qualityContract", "perspectiveMode", v)}
                  clearable
                />
              </SimpleGrid>
              <SimpleGrid cols={2}>
                <NumberInput
                  label="Alignment Tolerance (px)"
                  value={(nestedVal("qualityContract", "alignmentTolerancePx") as number) ?? undefined}
                  onChange={(v) => patchNested("qualityContract", "alignmentTolerancePx", v)}
                  min={0}
                />
                <NumberInput
                  label="Silhouette Drift Tolerance"
                  description="0.0 – 1.0"
                  value={(nestedVal("qualityContract", "silhouetteDriftTolerance") as number) ?? undefined}
                  onChange={(v) => patchNested("qualityContract", "silhouetteDriftTolerance", v)}
                  min={0}
                  max={1}
                  step={0.05}
                  decimalScale={2}
                />
              </SimpleGrid>
              <TextInput
                label="Required States (comma-separated)"
                placeholder="e.g. idle, run, attack"
                value={((nestedVal("qualityContract", "requiredStates") as string[]) ?? []).join(", ")}
                onChange={(e) => {
                  const states = e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean);
                  patchNested("qualityContract", "requiredStates", states);
                }}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* ──────────── LoRA Policy ──────────── */}
        <Tabs.Panel value="lora" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="md">
              <Text fw={600}>LoRA Policy</Text>
              <Text size="sm" c="dimmed">
                Controls LoRA selection strategy for this spec's generation jobs.
              </Text>
              <SimpleGrid cols={2}>
                <Select
                  label="Mode"
                  data={[
                    { value: "manual", label: "Manual" },
                    { value: "baseline_then_project", label: "Baseline → Project" },
                    { value: "project_then_baseline", label: "Project → Baseline" },
                    { value: "baseline_only", label: "Baseline Only" },
                    { value: "project_only", label: "Project Only" },
                  ]}
                  value={(nestedVal("loraPolicy", "mode") as string) ?? ""}
                  onChange={(v) => patchNested("loraPolicy", "mode", v)}
                  clearable
                />
                <Select
                  label="Release Policy"
                  data={[
                    { value: "active_or_latest_approved", label: "Active or Latest Approved" },
                    { value: "active_only", label: "Active Only" },
                  ]}
                  value={(nestedVal("loraPolicy", "releasePolicy") as string) ?? ""}
                  onChange={(v) => patchNested("loraPolicy", "releasePolicy", v)}
                  clearable
                />
              </SimpleGrid>
              <SimpleGrid cols={2}>
                <NumberInput
                  label="Max Active LoRAs"
                  value={(nestedVal("loraPolicy", "maxActiveLoras") as number) ?? undefined}
                  onChange={(v) => patchNested("loraPolicy", "maxActiveLoras", v)}
                  min={0}
                  max={10}
                />
                <Switch
                  label="Prefer Recommended"
                  checked={(nestedVal("loraPolicy", "preferRecommended") as boolean) ?? false}
                  onChange={(e) => patchNested("loraPolicy", "preferRecommended", e.currentTarget.checked)}
                  mt="lg"
                />
              </SimpleGrid>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* ──────────── Seed Policy ──────────── */}
        <Tabs.Panel value="seed" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="md">
              <Text fw={600}>Seed Policy</Text>
              <Text size="sm" c="dimmed">
                Determines how generation seeds are chosen — fixed, derived from spec properties, or random-recorded.
              </Text>
              <SimpleGrid cols={2}>
                <Select
                  label="Mode"
                  data={[
                    { value: "fixed", label: "Fixed" },
                    { value: "derived", label: "Derived" },
                    { value: "random_recorded", label: "Random Recorded" },
                  ]}
                  value={(nestedVal("seedPolicy", "mode") as string) ?? ""}
                  onChange={(v) => patchNested("seedPolicy", "mode", v)}
                  clearable
                />
                <NumberInput
                  label="Base Seed"
                  value={(nestedVal("seedPolicy", "baseSeed") as number) ?? undefined}
                  onChange={(v) => patchNested("seedPolicy", "baseSeed", v)}
                />
              </SimpleGrid>
              <TextInput
                label="Derive From (comma-separated fields)"
                placeholder="e.g. specId, assetType, checkpointId"
                value={((nestedVal("seedPolicy", "deriveFrom") as string[]) ?? []).join(", ")}
                onChange={(e) => {
                  const fields = e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean);
                  patchNested("seedPolicy", "deriveFrom", fields);
                }}
              />
              <TextInput
                label="Hash Algorithm"
                placeholder="fnv1a (default)"
                value={(nestedVal("seedPolicy", "hashAlgo") as string) ?? ""}
                onChange={(e) => patchNested("seedPolicy", "hashAlgo", e.currentTarget.value)}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* ──────────── Entity & Style ──────────── */}
        <Tabs.Panel value="entity" pt="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="md">
              <Text fw={600}>Entity Link</Text>
              <Text size="sm" c="dimmed">
                Bind the spec to a game entity for cross-output cohesion tracking.
              </Text>
              <SimpleGrid cols={2}>
                <TextInput
                  label="Entity ID"
                  value={(nestedVal("entityLink", "entityId") as string) ?? ""}
                  onChange={(e) => patchNested("entityLink", "entityId", e.currentTarget.value)}
                />
                <Select
                  label="Role"
                  data={[
                    { value: "animation", label: "Animation" },
                    { value: "pickup_icon", label: "Pickup Icon" },
                    { value: "portrait", label: "Portrait" },
                    { value: "ui_card", label: "UI Card" },
                  ]}
                  value={(nestedVal("entityLink", "role") as string) ?? ""}
                  onChange={(v) => patchNested("entityLink", "role", v)}
                  clearable
                />
              </SimpleGrid>

              <Divider label="Style Consistency" />
              <SimpleGrid cols={2}>
                <Select
                  label="Mode"
                  data={[
                    { value: "inherit_project", label: "Inherit Project" },
                    { value: "lock_to_spec_style", label: "Lock to Spec Style" },
                    { value: "lock_to_anchor_set", label: "Lock to Anchor Set" },
                  ]}
                  value={(nestedVal("styleConsistency", "mode") as string) ?? ""}
                  onChange={(v) => patchNested("styleConsistency", "mode", v)}
                  clearable
                />
                <TextInput
                  label="Anchor Refs (comma-separated)"
                  placeholder="e.g. asset_001, asset_002"
                  value={((nestedVal("styleConsistency", "anchorRefs") as string[]) ?? []).join(", ")}
                  onChange={(e) => {
                    const refs = e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean);
                    patchNested("styleConsistency", "anchorRefs", refs);
                  }}
                />
              </SimpleGrid>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
