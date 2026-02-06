import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";

import {
  createAutomationRule,
  executeAutomationRun,
  listAutomationRules,
  listAutomationRuns,
  type AutomationRule,
  type AutomationRun,
} from "../api";
import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";

type ConditionDraft = {
  id: string;
  field: string;
  op: "equals" | "in";
  value: string;
};

type ActionDraft = {
  id: string;
  type:
    | "enqueue_job"
    | "run_eval_grid"
    | "enqueue_lora_renders"
    | "apply_tags"
    | "set_status"
    | "export"
    | "auto_atlas_pack";
  jobType: "generate" | "bg_remove" | "atlas_pack" | "export";
  specId: string;
  checkpointName: string;
  templateId: string;
  promptsText: string;
  variants: number;
  limit: number;
  statusesCsv: string;
  addTagsCsv: string;
  removeTagsCsv: string;
  setTagsCsv: string;
  assetId: string;
  versionId: string;
  variantId: string;
  statusValue: string;
  exportAssetIdsCsv: string;
  exportAtlasIdsCsv: string;
  profileId: string;
  padding: number;
  maxSize: number;
  trim: boolean;
};

const TRIGGER_OPTIONS = [
  { value: "spec_refined", label: "Spec refined" },
  { value: "asset_approved", label: "Asset approved" },
  { value: "atlas_ready", label: "Atlas ready" },
  { value: "lora_release_activated", label: "LoRA release activated" },
  { value: "schedule", label: "Schedule" },
  { value: "manual", label: "Manual" },
];

const ACTION_OPTIONS = [
  { value: "enqueue_job", label: "Enqueue job" },
  { value: "run_eval_grid", label: "Run eval grid" },
  { value: "enqueue_lora_renders", label: "Enqueue LoRA renders" },
  { value: "apply_tags", label: "Apply tags" },
  { value: "set_status", label: "Set status" },
  { value: "export", label: "Export" },
  { value: "auto_atlas_pack", label: "Auto atlas pack" },
];

const PRESETS = [
  {
    id: "approve-bg-atlas",
    label: "Approved -> auto atlas pack",
    description: "When an asset is approved, auto-pack atlas for animation sequences.",
    triggerType: "asset_approved" as const,
    actionTypes: ["auto_atlas_pack" as const],
  },
  {
    id: "spec-ready-generate",
    label: "Spec refined -> generate",
    description: "Queue generate jobs when specs are refined.",
    triggerType: "spec_refined" as const,
    actionTypes: ["enqueue_job" as const],
  },
  {
    id: "lora-activate",
    label: "LoRA activation autopilot",
    description: "Run eval grid and queue compatible renders after activation.",
    triggerType: "lora_release_activated" as const,
    actionTypes: ["run_eval_grid" as const, "enqueue_lora_renders" as const],
  },
];

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrimitive(value: string) {
  const raw = value.trim();
  if (!raw.length) return "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  const num = Number(raw);
  return Number.isFinite(num) && String(num) === raw ? num : raw;
}

function emptyAction(id: string): ActionDraft {
  return {
    id,
    type: "enqueue_job",
    jobType: "generate",
    specId: "",
    checkpointName: "",
    templateId: "txt2img",
    promptsText: "",
    variants: 2,
    limit: 20,
    statusesCsv: "draft,ready",
    addTagsCsv: "",
    removeTagsCsv: "",
    setTagsCsv: "",
    assetId: "",
    versionId: "",
    variantId: "",
    statusValue: "approved",
    exportAssetIdsCsv: "",
    exportAtlasIdsCsv: "",
    profileId: "",
    padding: 2,
    maxSize: 2048,
    trim: true,
  };
}

export function AutomationPage() {
  const { selectedProjectId, setError } = useAppData();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [ruleNotes, setRuleNotes] = useState("");
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [triggerType, setTriggerType] = useState<AutomationRule["trigger"]["type"]>("asset_approved");
  const [scheduleCron, setScheduleCron] = useState("0 2 * * *");
  const [scheduleTz, setScheduleTz] = useState("UTC");
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([emptyAction("action-1")]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [dryRun, setDryRun] = useState(true);

  const isReady = Boolean(selectedProjectId);

  async function refresh() {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const [{ rules }, { runs }] = await Promise.all([
        listAutomationRules(selectedProjectId),
        listAutomationRuns(selectedProjectId),
      ]);
      setRules(rules);
      setRuns(runs);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e?.message ?? String(e)));
  }, [selectedProjectId]);

  function updateAction(id: string, patch: Partial<ActionDraft>) {
    setActions((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addAction() {
    setActions((prev) => [...prev, emptyAction(`action-${prev.length + 1}`)]);
  }

  function removeAction(id: string) {
    setActions((prev) => prev.filter((item) => item.id !== id));
  }

  function applyPreset(id: string) {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setRuleName(preset.label);
    setRuleDescription(preset.description);
    setTriggerType(preset.triggerType);
    setActions(preset.actionTypes.map((type, idx) => ({ ...emptyAction(`action-${idx + 1}`), type })));
  }

  function buildConditions() {
    if (conditions.length === 0) return undefined;
    return {
      all: conditions
        .filter((item) => item.field.trim())
        .map((item) =>
          item.op === "in"
            ? { field: item.field.trim(), in: splitCsv(item.value).map(parsePrimitive) }
            : { field: item.field.trim(), equals: parsePrimitive(item.value) },
        ),
    };
  }

  function buildAction(action: ActionDraft) {
    if (action.type === "enqueue_job") {
      return {
        type: action.type,
        config: {
          type: action.jobType,
          input: {
            ...(action.specId.trim() ? { specId: action.specId.trim() } : {}),
            ...(action.templateId.trim() ? { templateId: action.templateId.trim() } : {}),
            ...(action.checkpointName.trim() ? { checkpointName: action.checkpointName.trim() } : {}),
          },
        },
      };
    }
    if (action.type === "run_eval_grid") {
      return {
        type: action.type,
        config: {
          prompts: action.promptsText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          variants: action.variants,
          templateId: action.templateId || "txt2img",
        },
      };
    }
    if (action.type === "enqueue_lora_renders") {
      return {
        type: action.type,
        config: {
          limit: action.limit,
          statuses: splitCsv(action.statusesCsv),
          templateId: action.templateId || "txt2img",
        },
      };
    }
    if (action.type === "apply_tags") {
      return {
        type: action.type,
        config: {
          ...(action.assetId.trim() ? { assetId: action.assetId.trim() } : {}),
          ...(action.versionId.trim() ? { versionId: action.versionId.trim() } : {}),
          ...(action.variantId.trim() ? { variantId: action.variantId.trim() } : {}),
          ...(action.setTagsCsv.trim() ? { set: splitCsv(action.setTagsCsv) } : {}),
          ...(action.addTagsCsv.trim() ? { add: splitCsv(action.addTagsCsv) } : {}),
          ...(action.removeTagsCsv.trim() ? { remove: splitCsv(action.removeTagsCsv) } : {}),
        },
      };
    }
    if (action.type === "set_status") {
      return {
        type: action.type,
        config: {
          ...(action.assetId.trim() ? { assetId: action.assetId.trim() } : {}),
          ...(action.versionId.trim() ? { versionId: action.versionId.trim() } : {}),
          ...(action.variantId.trim() ? { variantId: action.variantId.trim() } : {}),
          status: action.statusValue || "approved",
        },
      };
    }
    if (action.type === "export") {
      return {
        type: action.type,
        config: {
          assetIds: splitCsv(action.exportAssetIdsCsv),
          atlasIds: splitCsv(action.exportAtlasIdsCsv),
          ...(action.profileId.trim() ? { profileId: action.profileId.trim() } : {}),
        },
      };
    }
    return {
      type: action.type,
      config: {
        padding: action.padding,
        maxSize: action.maxSize,
        trim: action.trim,
      },
    };
  }

  const naturalPreview = useMemo(() => {
    const conditionsText = conditions.length
      ? ` and ${conditions
          .map((item) =>
            item.op === "in"
              ? `${item.field} in [${splitCsv(item.value).join(", ")}]`
              : `${item.field} equals ${item.value || "(empty)"}`,
          )
          .join(" and ")}`
      : "";
    const actionsText = actions.map((item) => item.type).join(" then ");
    return `When ${triggerType}${conditionsText}, then ${actionsText || "(no actions)"}.`;
  }, [actions, conditions, triggerType]);

  async function onCreateRule() {
    if (!selectedProjectId) return;
    setBuilderError(null);
    if (!ruleName.trim()) return setBuilderError("Rule name is required.");
    if (actions.length === 0) return setBuilderError("Add at least one action.");

    const trigger: AutomationRule["trigger"] =
      triggerType === "schedule"
        ? { type: triggerType, schedule: { cron: scheduleCron, timezone: scheduleTz } }
        : { type: triggerType };

    try {
      await createAutomationRule(selectedProjectId, {
        name: ruleName.trim(),
        description: ruleDescription.trim() || undefined,
        notes: ruleNotes.trim() || undefined,
        enabled: ruleEnabled,
        trigger,
        conditions: buildConditions() as Record<string, unknown> | undefined,
        actions: actions.map(buildAction),
      });
      setRuleName("");
      setRuleDescription("");
      setRuleNotes("");
      setConditions([]);
      setActions([emptyAction("action-1")]);
      await refresh();
    } catch (e: any) {
      setBuilderError(e?.message ?? String(e));
    }
  }

  async function onRunRule() {
    if (!selectedProjectId || !selectedRuleId) return;
    try {
      await executeAutomationRun(selectedProjectId, { ruleId: selectedRuleId, dryRun });
      await refresh();
    } catch (e: any) {
      setBuilderError(e?.message ?? String(e));
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={2}>Automation</Title>
          <HelpTip label="Workflow automation basics" topicId="workflow-automation" />
        </Group>
        <Button variant="light" onClick={() => refresh()} disabled={!isReady || loading}>
          Refresh
        </Button>
      </Group>
      <Text c="dimmed">Sentence-style rule builder with structured action forms.</Text>

      <Card withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Rule builder</Title>
            <Button onClick={() => onCreateRule().catch(() => undefined)} disabled={!isReady}>
              Save rule
            </Button>
          </Group>

          {builderError && <Text c="red">{builderError}</Text>}

          <Group>
            <Select
              placeholder="Select preset"
              data={PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
              value={presetId}
              onChange={setPresetId}
              w={280}
            />
            <Button variant="light" disabled={!presetId} onClick={() => presetId && applyPreset(presetId)}>
              Apply preset
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Rule name"
              value={ruleName}
              onChange={(event) => setRuleName(event.currentTarget.value)}
            />
            <Switch
              label="Enabled"
              checked={ruleEnabled}
              onChange={(event) => setRuleEnabled(event.currentTarget.checked)}
            />
          </SimpleGrid>
          <TextInput
            label="Description"
            value={ruleDescription}
            onChange={(event) => setRuleDescription(event.currentTarget.value)}
          />
          <TextInput label="Notes" value={ruleNotes} onChange={(event) => setRuleNotes(event.currentTarget.value)} />

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Select
              label="When"
              data={TRIGGER_OPTIONS}
              value={triggerType}
              onChange={(value) => setTriggerType((value as any) ?? "asset_approved")}
            />
            {triggerType === "schedule" && (
              <>
                <TextInput
                  label="Cron"
                  value={scheduleCron}
                  onChange={(event) => setScheduleCron(event.currentTarget.value)}
                />
                <TextInput
                  label="Timezone"
                  value={scheduleTz}
                  onChange={(event) => setScheduleTz(event.currentTarget.value)}
                />
              </>
            )}
          </SimpleGrid>

          <Card withBorder radius="sm" p="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>Conditions</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setConditions((prev) => [
                      ...prev,
                      { id: `cond-${prev.length + 1}`, field: "assetType", op: "equals", value: "" },
                    ])
                  }
                >
                  Add condition
                </Button>
              </Group>
              {conditions.map((condition, index) => (
                <SimpleGrid key={condition.id} cols={{ base: 1, md: 4 }}>
                  <TextInput
                    label="Field"
                    value={condition.field}
                    onChange={(event) =>
                      setConditions((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, field: event.currentTarget.value } : item)),
                      )
                    }
                  />
                  <Select
                    label="Operator"
                    data={[
                      { value: "equals", label: "equals" },
                      { value: "in", label: "in list" },
                    ]}
                    value={condition.op}
                    onChange={(value) =>
                      setConditions((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, op: (value as any) ?? "equals" } : item)),
                      )
                    }
                  />
                  <TextInput
                    label={condition.op === "in" ? "Values (csv)" : "Value"}
                    value={condition.value}
                    onChange={(event) =>
                      setConditions((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, value: event.currentTarget.value } : item)),
                      )
                    }
                  />
                  <Button
                    mt={24}
                    color="red"
                    variant="light"
                    onClick={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </SimpleGrid>
              ))}
            </Stack>
          </Card>

          <Card withBorder radius="sm" p="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>Actions</Text>
                <Button size="xs" variant="light" onClick={addAction}>
                  Add action
                </Button>
              </Group>
              {actions.map((action, index) => (
                <Card key={action.id} withBorder radius="sm" p="sm">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Select
                        label="Then"
                        data={ACTION_OPTIONS}
                        value={action.type}
                        onChange={(value) => updateAction(action.id, { type: (value as any) ?? "enqueue_job" })}
                      />
                      <Button
                        color="red"
                        variant="light"
                        onClick={() => removeAction(action.id)}
                        disabled={actions.length <= 1}
                      >
                        Remove
                      </Button>
                    </Group>

                    {action.type === "enqueue_job" && (
                      <SimpleGrid cols={{ base: 1, md: 4 }}>
                        <Select
                          label="Job type"
                          data={[
                            { value: "generate", label: "generate" },
                            { value: "bg_remove", label: "bg_remove" },
                            { value: "atlas_pack", label: "atlas_pack" },
                            { value: "export", label: "export" },
                          ]}
                          value={action.jobType}
                          onChange={(value) => updateAction(action.id, { jobType: (value as any) ?? "generate" })}
                        />
                        <TextInput
                          label="Spec ID"
                          value={action.specId}
                          onChange={(event) => updateAction(action.id, { specId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Template ID"
                          value={action.templateId}
                          onChange={(event) => updateAction(action.id, { templateId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Checkpoint"
                          value={action.checkpointName}
                          onChange={(event) => updateAction(action.id, { checkpointName: event.currentTarget.value })}
                        />
                      </SimpleGrid>
                    )}

                    {action.type === "run_eval_grid" && (
                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <Textarea
                          label="Prompts (one per line)"
                          value={action.promptsText}
                          onChange={(event) => updateAction(action.id, { promptsText: event.currentTarget.value })}
                          minRows={2}
                        />
                        <NumberInput
                          label="Variants"
                          min={1}
                          max={8}
                          value={action.variants}
                          onChange={(value) => updateAction(action.id, { variants: Number(value ?? 2) })}
                        />
                        <TextInput
                          label="Template ID"
                          value={action.templateId}
                          onChange={(event) => updateAction(action.id, { templateId: event.currentTarget.value })}
                        />
                      </SimpleGrid>
                    )}

                    {action.type === "enqueue_lora_renders" && (
                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <NumberInput
                          label="Limit"
                          min={1}
                          max={200}
                          value={action.limit}
                          onChange={(value) => updateAction(action.id, { limit: Number(value ?? 20) })}
                        />
                        <TextInput
                          label="Statuses (csv)"
                          value={action.statusesCsv}
                          onChange={(event) => updateAction(action.id, { statusesCsv: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Template ID"
                          value={action.templateId}
                          onChange={(event) => updateAction(action.id, { templateId: event.currentTarget.value })}
                        />
                      </SimpleGrid>
                    )}

                    {action.type === "apply_tags" && (
                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <TextInput
                          label="Asset ID"
                          value={action.assetId}
                          onChange={(event) => updateAction(action.id, { assetId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Version ID"
                          value={action.versionId}
                          onChange={(event) => updateAction(action.id, { versionId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Variant ID"
                          value={action.variantId}
                          onChange={(event) => updateAction(action.id, { variantId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Set tags (csv)"
                          value={action.setTagsCsv}
                          onChange={(event) => updateAction(action.id, { setTagsCsv: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Add tags (csv)"
                          value={action.addTagsCsv}
                          onChange={(event) => updateAction(action.id, { addTagsCsv: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Remove tags (csv)"
                          value={action.removeTagsCsv}
                          onChange={(event) => updateAction(action.id, { removeTagsCsv: event.currentTarget.value })}
                        />
                      </SimpleGrid>
                    )}

                    {action.type === "set_status" && (
                      <SimpleGrid cols={{ base: 1, md: 4 }}>
                        <TextInput
                          label="Asset ID"
                          value={action.assetId}
                          onChange={(event) => updateAction(action.id, { assetId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Version ID"
                          value={action.versionId}
                          onChange={(event) => updateAction(action.id, { versionId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Variant ID"
                          value={action.variantId}
                          onChange={(event) => updateAction(action.id, { variantId: event.currentTarget.value })}
                        />
                        <TextInput
                          label="Status"
                          value={action.statusValue}
                          onChange={(event) => updateAction(action.id, { statusValue: event.currentTarget.value })}
                        />
                      </SimpleGrid>
                    )}

                    {action.type === "export" && (
                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <TextInput
                          label="Asset IDs (csv)"
                          value={action.exportAssetIdsCsv}
                          onChange={(event) =>
                            updateAction(action.id, { exportAssetIdsCsv: event.currentTarget.value })
                          }
                        />
                        <TextInput
                          label="Atlas IDs (csv)"
                          value={action.exportAtlasIdsCsv}
                          onChange={(event) =>
                            updateAction(action.id, { exportAtlasIdsCsv: event.currentTarget.value })
                          }
                        />
                        <TextInput
                          label="Profile ID"
                          value={action.profileId}
                          onChange={(event) => updateAction(action.id, { profileId: event.currentTarget.value })}
                        />
                      </SimpleGrid>
                    )}

                    {action.type === "auto_atlas_pack" && (
                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <NumberInput
                          label="Padding"
                          value={action.padding}
                          min={0}
                          onChange={(value) => updateAction(action.id, { padding: Number(value ?? 2) })}
                        />
                        <NumberInput
                          label="Max size"
                          value={action.maxSize}
                          min={128}
                          step={64}
                          onChange={(value) => updateAction(action.id, { maxSize: Number(value ?? 2048) })}
                        />
                        <Switch
                          label="Trim"
                          checked={action.trim}
                          onChange={(event) => updateAction(action.id, { trim: event.currentTarget.checked })}
                        />
                      </SimpleGrid>
                    )}
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Card>

          <Card withBorder radius="sm" p="sm">
            <Text fw={600}>Preview</Text>
            <Text size="sm" c="dimmed">
              {naturalPreview}
            </Text>
          </Card>

          <Group>
            <Select
              placeholder="Select rule"
              data={rules.map((rule) => ({ value: rule.id, label: rule.name }))}
              value={selectedRuleId}
              onChange={(value) => setSelectedRuleId(value ?? "")}
              w={280}
            />
            <Switch label="Dry run" checked={dryRun} onChange={(event) => setDryRun(event.currentTarget.checked)} />
            <Button
              variant="light"
              onClick={() => onRunRule().catch(() => undefined)}
              disabled={!selectedRuleId || !isReady}
            >
              Run rule
            </Button>
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text fw={600}>Rules</Text>
            <Badge variant="light">{rules.length}</Badge>
          </Group>
          <Stack gap="xs" mt="sm">
            {rules.map((rule) => (
              <Card key={rule.id} withBorder radius="sm" p="sm">
                <Group justify="space-between">
                  <Text fw={600}>{rule.name}</Text>
                  <Badge variant="light" color={rule.enabled ? "green" : "gray"}>
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Trigger: {rule.trigger.type} � Actions: {rule.actions.length}
                </Text>
              </Card>
            ))}
            {rules.length === 0 && (
              <Text size="sm" c="dimmed">
                No rules yet.
              </Text>
            )}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text fw={600}>Runs</Text>
            <Badge variant="light">{runs.length}</Badge>
          </Group>
          <Stack gap="xs" mt="sm">
            {runs.slice(0, 8).map((run) => (
              <Card key={run.id} withBorder radius="sm" p="sm">
                <Group justify="space-between">
                  <Text fw={600}>{run.ruleId}</Text>
                  <Badge
                    variant="light"
                    color={
                      run.status === "succeeded"
                        ? "green"
                        : run.status === "failed"
                          ? "red"
                          : run.status === "running"
                            ? "yellow"
                            : "gray"
                    }
                  >
                    {run.status}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {run.dryRun ? "Dry run" : "Live"}
                </Text>
              </Card>
            ))}
            {runs.length === 0 && (
              <Text size="sm" c="dimmed">
                No runs yet.
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
