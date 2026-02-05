import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  List,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
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

type ActionDraft = {
  id: string;
  type: "enqueue_job" | "run_eval_grid" | "apply_tags" | "set_status" | "export";
  config: string;
};

const TRIGGER_OPTIONS = [
  { value: "spec_refined", label: "Spec refined" },
  { value: "asset_approved", label: "Asset approved" },
  { value: "atlas_ready", label: "Atlas ready" },
  { value: "schedule", label: "Schedule" },
  { value: "manual", label: "Manual" },
];

const ACTION_OPTIONS = [
  { value: "enqueue_job", label: "Enqueue job" },
  { value: "run_eval_grid", label: "Run eval grid" },
  { value: "apply_tags", label: "Apply tags" },
  { value: "set_status", label: "Set status" },
  { value: "export", label: "Export" },
];

const PRESETS = [
  {
    id: "approve-bg-atlas",
    label: "Approve -> bg remove -> atlas",
    description: "Auto-queue background removal then atlas pack when an asset version is approved.",
    ruleName: "Auto-pack approved assets",
    triggerType: "asset_approved" as const,
    actions: [
      { type: "enqueue_job" as const, config: '{ "type": "bg_remove", "input": { "assetId": "<assetId>" } }' },
      { type: "enqueue_job" as const, config: '{ "type": "atlas_pack", "input": { "assetId": "<assetId>" } }' },
    ],
  },
  {
    id: "atlas-export",
    label: "Atlas ready -> export",
    description: "Auto-export when an atlas is updated (manual mapping required).",
    ruleName: "Export on atlas ready",
    triggerType: "atlas_ready" as const,
    actions: [{ type: "enqueue_job" as const, config: '{ "type": "export", "input": { "atlasId": "<atlasId>" } }' }],
  },
  {
    id: "spec-ready-generate",
    label: "Spec ready -> generate",
    description: "Queue generation when a spec is marked ready.",
    ruleName: "Generate on spec ready",
    triggerType: "spec_refined" as const,
    actions: [{ type: "enqueue_job" as const, config: '{ "type": "generate", "input": { "specId": "<specId>" } }' }],
  },
];

function createEmptyAction(id: string): ActionDraft {
  return { id, type: "enqueue_job", config: "{}" };
}

function parseJson(input: string) {
  if (!input.trim()) return { ok: true as const, value: undefined };
  try {
    return { ok: true as const, value: JSON.parse(input) };
  } catch (error: any) {
    return { ok: false as const, error: error?.message ?? String(error) };
  }
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
  const [conditionsJson, setConditionsJson] = useState("{}");
  const [actions, setActions] = useState<ActionDraft[]>([createEmptyAction("action-1")]);
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

  const ruleSummary = useMemo(() => {
    if (!rules.length) return "No rules configured yet.";
    const enabled = rules.filter((rule) => rule.enabled).length;
    return `${enabled} enabled / ${rules.length} total`;
  }, [rules]);

  const conditionsParsed = useMemo(() => parseJson(conditionsJson), [conditionsJson]);
  const actionErrors = useMemo(() => {
    return actions.map((action) => ({ id: action.id, result: parseJson(action.config) }));
  }, [actions]);
  const isSaveDisabled = useMemo(() => {
    if (!isReady) return true;
    if (!ruleName.trim()) return true;
    if (!conditionsParsed.ok) return true;
    if (actions.length === 0) return true;
    return actionErrors.some((entry) => !entry.result.ok);
  }, [actions.length, actionErrors, conditionsParsed.ok, isReady, ruleName]);

  function addAction() {
    setActions((prev) => [...prev, createEmptyAction(`action-${prev.length + 1}`)]);
  }

  function updateAction(id: string, patch: Partial<ActionDraft>) {
    setActions((prev) => prev.map((action) => (action.id === id ? { ...action, ...patch } : action)));
  }

  function removeAction(id: string) {
    setActions((prev) => prev.filter((action) => action.id !== id));
  }

  function applyPreset(id: string) {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setRuleName(preset.ruleName);
    setRuleDescription(preset.description);
    setTriggerType(preset.triggerType);
    setActions(preset.actions.map((action, index) => ({ id: `action-${index + 1}`, ...action })));
  }

  async function onCreateRule() {
    if (!selectedProjectId) return;
    setBuilderError(null);
    if (!conditionsParsed.ok) return setBuilderError(`Conditions JSON invalid: ${conditionsParsed.error}`);

    const actionPayload = [];
    for (const action of actions) {
      const parsed = parseJson(action.config);
      if (!parsed.ok) {
        setBuilderError(`Action "${action.id}" JSON invalid: ${parsed.error}`);
        return;
      }
      actionPayload.push({ type: action.type, config: parsed.value });
    }
    if (!ruleName.trim()) {
      setBuilderError("Rule name is required.");
      return;
    }
    if (actionPayload.length === 0) {
      setBuilderError("Add at least one action.");
      return;
    }

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
        actions: actionPayload,
        conditions: conditionsParsed.value,
      });
      setRuleName("");
      setRuleDescription("");
      setRuleNotes("");
      setConditionsJson("{}");
      setActions([createEmptyAction("action-1")]);
      await refresh();
    } catch (e: any) {
      setBuilderError(e?.message ?? String(e));
    }
  }

  async function onRunRule() {
    if (!selectedProjectId || !selectedRuleId) return;
    setBuilderError(null);
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
        <Group>
          <Button variant="light" onClick={() => refresh()} disabled={!isReady || loading}>
            Refresh
          </Button>
          <Button disabled>New rule (soon)</Button>
        </Group>
      </Group>
      <Text c="dimmed">
        Define rules that trigger multi-step jobs. Start with safe presets, then expand to custom triggers and actions.
      </Text>

      <Card withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Title order={4}>Rule builder</Title>
              <Text size="sm" c="dimmed">
                Draft a rule and save it to the project.
              </Text>
            </div>
            <Button onClick={onCreateRule} disabled={isSaveDisabled}>
              Save rule
            </Button>
          </Group>
          {builderError && (
            <Text size="sm" c="red">
              {builderError}
            </Text>
          )}
          <Card withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Text fw={600}>Presets</Text>
              <Text size="sm" c="dimmed">
                Start with a preset, then customize the fields below.
              </Text>
              <Group>
                <Select
                  placeholder="Select preset"
                  data={PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                  value={presetId}
                  onChange={(value) => setPresetId(value)}
                  w={260}
                />
                <Button
                  variant="light"
                  disabled={!presetId}
                  onClick={() => {
                    if (presetId) applyPreset(presetId);
                  }}
                >
                  Apply preset
                </Button>
              </Group>
              {presetId && (
                <Text size="xs" c="dimmed">
                  {PRESETS.find((preset) => preset.id === presetId)?.description}
                </Text>
              )}
            </Stack>
          </Card>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Rule name"
              placeholder="Auto-pack approved sprites"
              value={ruleName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRuleName(event.currentTarget.value)}
            />
            <Switch
              label="Enabled"
              checked={ruleEnabled}
              onChange={(event) => setRuleEnabled(event.currentTarget.checked)}
            />
          </SimpleGrid>
          <Textarea
            label="Description"
            placeholder="Runs bg removal and atlas packing after approval"
            value={ruleDescription}
            onChange={(event) => setRuleDescription(event.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            label="Notes"
            placeholder="Optional internal notes"
            value={ruleNotes}
            onChange={(event) => setRuleNotes(event.currentTarget.value)}
            minRows={2}
          />
          <Divider label="Trigger" />
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Select
              label="Trigger type"
              data={TRIGGER_OPTIONS}
              value={triggerType}
              onChange={(value) =>
                setTriggerType((value ?? "asset_approved") as AutomationRule["trigger"]["type"])
              }
            />
            {triggerType === "schedule" && (
              <Stack gap="xs">
                <TextInput
                  label="Cron"
                  value={scheduleCron}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setScheduleCron(event.currentTarget.value)}
                />
                <TextInput
                  label="Timezone"
                  value={scheduleTz}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setScheduleTz(event.currentTarget.value)}
                />
              </Stack>
            )}
          </SimpleGrid>
          <Textarea
            label="Conditions (JSON)"
            value={conditionsJson}
            onChange={(event) => setConditionsJson(event.currentTarget.value)}
            minRows={3}
            error={conditionsParsed.ok ? undefined : "Invalid JSON"}
          />
          <Divider label="Actions" />
          <Stack gap="sm">
            {actions.map((action) => (
              <Card key={action.id} withBorder radius="md" p="sm">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Select
                      label="Action type"
                      data={ACTION_OPTIONS}
                      value={action.type}
                      onChange={(value) =>
                        updateAction(action.id, {
                          type: (value ?? "enqueue_job") as ActionDraft["type"],
                        })
                      }
                    />
                    <Button variant="light" color="red" onClick={() => removeAction(action.id)} disabled={actions.length <= 1}>
                      Remove
                    </Button>
                  </Group>
                  <Textarea
                    label="Action config (JSON)"
                    value={action.config}
                    onChange={(event) => updateAction(action.id, { config: event.currentTarget.value })}
                    minRows={3}
                    error={
                      actionErrors.find((entry) => entry.id === action.id)?.result.ok ? undefined : "Invalid JSON"
                    }
                  />
                </Stack>
              </Card>
            ))}
            <Button variant="light" onClick={addAction}>
              Add action
            </Button>
          </Stack>
          <Divider label="Guardrails" />
          <List size="sm" spacing="xs">
            <List.Item>Use dry-run before enabling rules.</List.Item>
            <List.Item>Keep actions narrow and explicit.</List.Item>
            <List.Item>Prefer idempotent rules to avoid repeated jobs.</List.Item>
          </List>
          <Divider label="Test run" />
          <Group>
            <Select
              placeholder="Select rule"
              data={rules.map((rule) => ({ value: rule.id, label: rule.name }))}
              value={selectedRuleId}
              onChange={(value) => setSelectedRuleId(value ?? "")}
              w={280}
            />
            <Switch label="Dry run" checked={dryRun} onChange={(event) => setDryRun(event.currentTarget.checked)} />
            <Button variant="light" onClick={onRunRule} disabled={!selectedRuleId || !isReady}>
              Run rule
            </Button>
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Rules</Text>
            <Badge variant="light">{rules.length}</Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="sm">
            {ruleSummary}
          </Text>
          <Stack gap="xs">
            {rules.length === 0 && <Text size="sm">No automation rules yet. Create one to start.</Text>}
            {rules.map((rule) => (
              <Card key={rule.id} withBorder radius="md" p="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{rule.name}</Text>
                    <Text size="xs" c="dimmed">
                      Trigger: {rule.trigger?.type ?? "unknown"} · Actions: {rule.actions?.length ?? 0}
                    </Text>
                  </div>
                  <Badge color={rule.enabled ? "green" : "gray"} variant="light">
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Runs</Text>
            <Badge variant="light">{runs.length}</Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="sm">
            Recent automation runs and dry-runs.
          </Text>
          <Stack gap="xs">
            {runs.length === 0 && <Text size="sm">No runs yet. Trigger a rule to see history.</Text>}
            {runs.slice(0, 6).map((run) => (
              <Card key={run.id} withBorder radius="md" p="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{run.ruleId}</Text>
                    <Text size="xs" c="dimmed">
                      Status: {run.status} · {run.dryRun ? "Dry run" : "Live"}
                    </Text>
                  </div>
                  <Badge
                    color={
                      run.status === "succeeded"
                        ? "green"
                        : run.status === "failed"
                          ? "red"
                          : run.status === "running"
                            ? "yellow"
                            : "gray"
                    }
                    variant="light"
                  >
                    {run.status}
                  </Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
