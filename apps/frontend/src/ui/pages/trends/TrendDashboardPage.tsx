import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

import { useAppData } from "../../context/AppDataContext";
import { useExpertMode } from "../../context/ExpertModeContext";
import {
  listTrendSnapshots,
  generateTrendSnapshot,
  listImprovementRuns,
  createImprovementRun,
  startImprovementRun,
  completeImprovementRun,
  promoteImprovementRun,
  rollbackImprovementRun,
  listCircuitBreakers,
  resetCircuitBreaker,
  backtestRule,
  getValidatorGapReport,
  listAutomationRules,
  type TrendSnapshot,
  type ImprovementRun,
  type CircuitBreaker,
  type BacktestReport,
  type ValidatorGapReport,
  type AutomationRule,
} from "../../api";

/* ── Helpers ───────────────────────────────────────────────────────── */

function pct(n?: number): string {
  if (n === undefined || n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function delta(n?: number): string {
  if (n === undefined || n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function relTime(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function stateColor(state: string): string {
  switch (state) {
    case "closed": return "green";
    case "open": return "red";
    case "half_open": return "yellow";
    case "completed": return "green";
    case "running": return "blue";
    case "draft": return "gray";
    case "failed": return "red";
    case "rolled_back": return "orange";
    case "promoted": return "green";
    case "deferred": return "yellow";
    case "pending": return "gray";
    default: return "gray";
  }
}

/* ── Component ─────────────────────────────────────────────────────── */

export function TrendDashboardPage() {
  const { selectedProjectId } = useAppData();
  const { expertMode } = useExpertMode();

  const [tab, setTab] = useState<"trends" | "improvements" | "breakers" | "backtest" | "gaps">("trends");

  // Data
  const [snapshots, setSnapshots] = useState<TrendSnapshot[]>([]);
  const [improvementRuns, setImprovementRuns] = useState<ImprovementRun[]>([]);
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [backtestReport, setBacktestReport] = useState<BacktestReport | null>(null);
  const [gapReport, setGapReport] = useState<ValidatorGapReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backtest form
  const [backtestRuleId, setBacktestRuleId] = useState<string | null>(null);

  // Create-run form
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [newRunName, setNewRunName] = useState("");
  const [newRunCohortMethod, setNewRunCohortMethod] = useState<string | null>("all");
  const [newRunCohortValue, setNewRunCohortValue] = useState("");
  const [newRunInterventionType, setNewRunInterventionType] = useState<string | null>("rule_change");
  const [newRunDescription, setNewRunDescription] = useState("");

  const loadData = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const [snapRes, irRes, cbRes, rulesRes] = await Promise.all([
        listTrendSnapshots(selectedProjectId, { limit: 30 }).catch(() => ({ snapshots: [] })),
        listImprovementRuns(selectedProjectId).catch(() => ({ runs: [] })),
        listCircuitBreakers(selectedProjectId).catch(() => ({ breakers: [] })),
        listAutomationRules(selectedProjectId).catch(() => ({ rules: [] })),
      ]);
      setSnapshots(snapRes.snapshots);
      setImprovementRuns(irRes.runs);
      setBreakers(cbRes.breakers);
      setRules(rulesRes.rules);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const ruleOptions = useMemo(
    () => rules.map((r) => ({ value: r.id, label: r.name })),
    [rules],
  );

  if (!selectedProjectId) {
    return (
      <Stack p="lg">
        <Title order={3}>Continuous Improvement</Title>
        <Text c="dimmed">Select a project to view trend data.</Text>
      </Stack>
    );
  }

  /* ── Handlers ──────────────────────────────────────────────────── */

  async function handleGenerateSnapshot() {
    setError(null);
    try {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await generateTrendSnapshot(selectedProjectId, { from, to, granularity: "daily" });
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleStartRun(runId: string) {
    try {
      await startImprovementRun(selectedProjectId, runId);
      await loadData();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }
  async function handleCompleteRun(runId: string) {
    try {
      await completeImprovementRun(selectedProjectId, runId);
      await loadData();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }
  async function handlePromoteRun(runId: string) {
    try {
      await promoteImprovementRun(selectedProjectId, runId);
      await loadData();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }
  async function handleRollbackRun(runId: string) {
    try {
      await rollbackImprovementRun(selectedProjectId, runId);
      await loadData();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }
  async function handleCreateRun() {
    if (!newRunName.trim()) return;
    setError(null);
    try {
      const cohort: Record<string, unknown> = { selectionMethod: newRunCohortMethod ?? "all" };
      if (newRunCohortMethod === "by_asset_type" && newRunCohortValue) cohort.assetType = newRunCohortValue;
      if (newRunCohortMethod === "by_checkpoint" && newRunCohortValue) cohort.checkpointId = newRunCohortValue;
      if (newRunCohortMethod === "by_tag" && newRunCohortValue) cohort.tag = newRunCohortValue;
      if (newRunCohortMethod === "by_entity_family" && newRunCohortValue) cohort.entityFamily = newRunCohortValue;
      await createImprovementRun(selectedProjectId, {
        name: newRunName.trim(),
        description: newRunDescription || undefined,
        cohort: cohort as any,
        intervention: { type: (newRunInterventionType ?? "rule_change") as any },
      });
      setNewRunName("");
      setNewRunCohortValue("");
      setNewRunDescription("");
      setShowCreateRun(false);
      await loadData();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }
  async function handleResetBreaker(breakerId: string) {
    try {
      await resetCircuitBreaker(selectedProjectId, breakerId);
      await loadData();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }
  async function handleBacktest() {
    if (!backtestRuleId) return;
    setError(null);
    try {
      const result = await backtestRule(selectedProjectId, backtestRuleId);
      setBacktestReport(result.report);
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }
  async function handleGapAnalysis() {
    setError(null);
    try {
      const result = await getValidatorGapReport(selectedProjectId);
      setGapReport(result.report);
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }

  /* ── Render ────────────────────────────────────────────────────── */

  const latestSnapshot = snapshots[0];

  return (
    <Stack className="ag-trend-dashboard" gap="md" p={0}>
      <Group justify="space-between">
        <Title order={3}>Continuous Improvement</Title>
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={() => loadData()}>Refresh</Button>
        </Group>
      </Group>

      {error && <Text c="red" size="sm">{error}</Text>}
      {loading && <Loader size="sm" />}

      {/* Summary Cards */}
      <Group gap="md" className="ag-trend-summary">
        <Card withBorder radius="md" p="md" className="ag-card-tier-2 ag-trend-card">
          <Text size="xs" c="dimmed">First-Pass Approval</Text>
          <Text fw={700} size="xl">{pct(latestSnapshot?.metrics.firstPassApprovalRate)}</Text>
        </Card>
        <Card withBorder radius="md" p="md" className="ag-card-tier-2 ag-trend-card">
          <Text size="xs" c="dimmed">Validator Pass Rate</Text>
          <Text fw={700} size="xl">{pct(latestSnapshot?.metrics.validatorPassRate)}</Text>
        </Card>
        <Card withBorder radius="md" p="md" className="ag-card-tier-2 ag-trend-card">
          <Text size="xs" c="dimmed">Auto-Resolved</Text>
          <Text fw={700} size="xl">{pct(latestSnapshot?.metrics.autoResolvedRate)}</Text>
        </Card>
        <Card withBorder radius="md" p="md" className="ag-card-tier-2 ag-trend-card">
          <Text size="xs" c="dimmed">Escalations</Text>
          <Text fw={700} size="xl">{latestSnapshot?.metrics.escalationCount ?? "—"}</Text>
        </Card>
        <Card withBorder radius="md" p="md" className="ag-card-tier-2 ag-trend-card">
          <Text size="xs" c="dimmed">Validator Gaps</Text>
          <Text fw={700} size="xl">{latestSnapshot?.metrics.validatorGapCount ?? "—"}</Text>
        </Card>
      </Group>

      {/* Tab Bar */}
      <Group gap="xs" className="ag-trend-tabs">
        {(["trends", "improvements", "breakers", ...(expertMode ? ["backtest", "gaps"] as const : [])] as const).map((t) => (
          <Button
            key={t}
            size="xs"
            variant={tab === t ? "filled" : "light"}
            onClick={() => setTab(t as typeof tab)}
          >
            {t === "trends" ? "Trend History" : t === "improvements" ? "Improvement Runs" : t === "breakers" ? "Circuit Breakers" : t === "backtest" ? "Rule Backtest" : "Validator Gaps"}
          </Button>
        ))}
      </Group>

      {/* ── Trend History ──────────────────────────────────────── */}
      {tab === "trends" && (
        <Card withBorder radius="md" p="md" className="ag-card-tier-1">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Trend Snapshots</Text>
            <Button size="xs" variant="light" onClick={handleGenerateSnapshot}>Generate Weekly Snapshot</Button>
          </Group>
          {snapshots.length === 0 ? (
            <Text size="sm" c="dimmed">No snapshots yet. Generate one to start tracking trends.</Text>
          ) : (
            <ScrollArea>
              <Table className="ag-trend-table" striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Period</Table.Th>
                    <Table.Th>Granularity</Table.Th>
                    <Table.Th>Jobs</Table.Th>
                    <Table.Th>1st Pass</Table.Th>
                    <Table.Th>Validator</Table.Th>
                    <Table.Th>Auto-Resolve</Table.Th>
                    <Table.Th>Escalations</Table.Th>
                    <Table.Th>Gaps</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {snapshots.map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td>{new Date(s.period.from).toLocaleDateString()} – {new Date(s.period.to).toLocaleDateString()}</Table.Td>
                      <Table.Td><Badge variant="light" size="sm">{s.period.granularity}</Badge></Table.Td>
                      <Table.Td>{s.metrics.totalJobs ?? 0} ({s.metrics.succeededJobs ?? 0}✓ {s.metrics.failedJobs ?? 0}✗)</Table.Td>
                      <Table.Td>{pct(s.metrics.firstPassApprovalRate)}</Table.Td>
                      <Table.Td>{pct(s.metrics.validatorPassRate)}</Table.Td>
                      <Table.Td>{pct(s.metrics.autoResolvedRate)}</Table.Td>
                      <Table.Td>{s.metrics.escalationCount ?? 0}</Table.Td>
                      <Table.Td>{s.metrics.validatorGapCount ?? 0}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      )}

      {/* ── Improvement Runs ───────────────────────────────────── */}
      {tab === "improvements" && (
        <Card withBorder radius="md" p="md" className="ag-card-tier-1">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Improvement Runs</Text>
            <Button size="xs" variant="light" onClick={() => setShowCreateRun((v) => !v)}>
              {showCreateRun ? "Cancel" : "+ New Run"}
            </Button>
          </Group>
          {showCreateRun && (
            <Card withBorder radius="sm" p="sm" mb="sm" className="ag-card-tier-2">
              <Stack gap="xs">
                <TextInput size="xs" placeholder="Run name" value={newRunName} onChange={(e) => setNewRunName(e.currentTarget.value)} />
                <Group gap="xs">
                  <Select size="xs" w={180} label="Cohort" data={[
                    { value: "all", label: "All specs" },
                    { value: "by_asset_type", label: "By asset type" },
                    { value: "by_checkpoint", label: "By checkpoint" },
                    { value: "by_tag", label: "By tag" },
                    { value: "by_entity_family", label: "By entity family" },
                  ]} value={newRunCohortMethod} onChange={setNewRunCohortMethod} />
                  {newRunCohortMethod && newRunCohortMethod !== "all" && (
                    <TextInput size="xs" placeholder="Filter value" value={newRunCohortValue} onChange={(e) => setNewRunCohortValue(e.currentTarget.value)} />
                  )}
                  <Select size="xs" w={200} label="Intervention" data={[
                    { value: "rule_change", label: "Rule change" },
                    { value: "baseline_update", label: "Baseline update" },
                    { value: "checkpoint_switch", label: "Checkpoint switch" },
                    { value: "prompt_tweak", label: "Prompt tweak" },
                    { value: "lora_swap", label: "LoRA swap" },
                    { value: "validator_threshold_change", label: "Validator threshold" },
                  ]} value={newRunInterventionType} onChange={setNewRunInterventionType} />
                </Group>
                <TextInput size="xs" placeholder="Description (optional)" value={newRunDescription} onChange={(e) => setNewRunDescription(e.currentTarget.value)} />
                <Button size="xs" variant="filled" onClick={handleCreateRun} disabled={!newRunName.trim()}>Create Run</Button>
              </Stack>
            </Card>
          )}
          {improvementRuns.length === 0 && !showCreateRun ? (
            <Text size="sm" c="dimmed">No improvement runs yet. Create one to start measuring quality lift.</Text>
          ) : (
            <Stack gap="sm">
              {improvementRuns.map((run) => (
                <Card key={run.id} withBorder radius="sm" p="sm" className="ag-card-tier-2">
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Text fw={600}>{run.name}</Text>
                      <Badge color={stateColor(run.status)} variant="light" size="sm">{run.status}</Badge>
                      {run.promotionDecision && run.promotionDecision !== "pending" && (
                        <Badge color={stateColor(run.promotionDecision)} variant="dot" size="sm">{run.promotionDecision}</Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">{relTime(run.createdAt)}</Text>
                  </Group>
                  <Group gap="lg" mb="xs">
                    <Text size="xs">Cohort: <strong>{run.cohort.selectionMethod}</strong> ({run.cohort.resolvedCount ?? 0} specs)</Text>
                    <Text size="xs">Intervention: <strong>{run.intervention.type}</strong></Text>
                  </Group>
                  {run.metrics?.delta && (
                    <Group gap="lg" mb="xs">
                      <Text size="xs">Quality Lift: <strong>{run.metrics.delta.qualityLiftPct?.toFixed(1) ?? "—"}%</strong></Text>
                      <Text size="xs">1st Pass Δ: {delta(run.metrics.delta.firstPassApprovalRateDelta)}</Text>
                      <Text size="xs">Validator Δ: {delta(run.metrics.delta.validatorPassRateDelta)}</Text>
                    </Group>
                  )}
                  {run.metrics?.before && run.metrics?.after && (
                    <Group gap="lg" mb="xs">
                      <Text size="xs" c="dimmed">Before: {pct(run.metrics.before.firstPassApprovalRate)} → After: {pct(run.metrics.after.firstPassApprovalRate)}</Text>
                    </Group>
                  )}
                  <Group gap="xs">
                    {run.status === "draft" && (
                      <Button size="xs" variant="light" color="blue" onClick={() => handleStartRun(run.id)}>Start</Button>
                    )}
                    {run.status === "running" && (
                      <Button size="xs" variant="light" color="green" onClick={() => handleCompleteRun(run.id)}>Complete</Button>
                    )}
                    {run.status === "completed" && run.promotionDecision === "pending" && (
                      <>
                        <Button size="xs" variant="light" color="green" onClick={() => handlePromoteRun(run.id)}>Promote</Button>
                        <Button size="xs" variant="light" color="orange" onClick={() => handleRollbackRun(run.id)}>Rollback</Button>
                      </>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Card>
      )}

      {/* ── Circuit Breakers ───────────────────────────────────── */}
      {tab === "breakers" && (
        <Card withBorder radius="md" p="md" className="ag-card-tier-1">
          <Text fw={600} mb="sm">Circuit Breakers</Text>
          {breakers.length === 0 ? (
            <Text size="sm" c="dimmed">No circuit breakers configured. They auto-create when automation rules fire.</Text>
          ) : (
            <ScrollArea>
              <Table className="ag-trend-table" striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rule</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>State</Table.Th>
                    <Table.Th>Tripped</Table.Th>
                    <Table.Th>Reason</Table.Th>
                    <Table.Th>Stats</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {breakers.map((b) => {
                    const ruleName = rules.find((r) => r.id === b.ruleId)?.name ?? b.ruleId ?? "global";
                    return (
                      <Table.Tr key={b.id}>
                        <Table.Td>{ruleName}</Table.Td>
                        <Table.Td><Badge variant="light" size="sm">{b.type}</Badge></Table.Td>
                        <Table.Td><Badge color={stateColor(b.state)} variant="filled" size="sm">{b.state}</Badge></Table.Td>
                        <Table.Td>{relTime(b.trippedAt)}</Table.Td>
                        <Table.Td><Text size="xs" lineClamp={1}>{b.trippedReason ?? "—"}</Text></Table.Td>
                        <Table.Td>
                          <Text size="xs">trips: {b.stats?.totalTrips ?? 0}, blocked: {b.stats?.blockedTriggers ?? 0}</Text>
                        </Table.Td>
                        <Table.Td>
                          {b.state !== "closed" && (
                            <Button size="xs" variant="light" color="green" onClick={() => handleResetBreaker(b.id)}>Reset</Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      )}

      {/* ── Rule Backtest (Expert) ─────────────────────────────── */}
      {tab === "backtest" && expertMode && (
        <Card withBorder radius="md" p="md" className="ag-card-tier-1">
          <Text fw={600} mb="sm">Rule Backtesting (Simulation)</Text>
          <Group gap="sm" mb="md">
            <Select
              placeholder="Select rule"
              data={ruleOptions}
              value={backtestRuleId}
              onChange={setBacktestRuleId}
              w={300}
              searchable
            />
            <Button size="xs" variant="filled" disabled={!backtestRuleId} onClick={handleBacktest}>Run Backtest</Button>
          </Group>
          {backtestReport && (
            <Card withBorder p="sm" radius="sm" className="ag-card-tier-2">
              <Text fw={600} mb="xs">{backtestReport.ruleName}</Text>
              <Group gap="lg" mb="xs">
                <Text size="sm">Events scanned: <strong>{backtestReport.totalEventsScanned}</strong></Text>
                <Text size="sm">Matched: <strong>{backtestReport.matchedEvents}</strong></Text>
                <Text size="sm">Est. jobs: <strong>{backtestReport.estimatedJobsEnqueued}</strong></Text>
              </Group>
              <Group gap="lg" mb="xs">
                <Text size="sm">Peak velocity: <strong>{backtestReport.peakTriggersPerMinute.toFixed(1)}/min</strong></Text>
                <Text size="sm">Avg: <strong>{backtestReport.avgTriggersPerHour.toFixed(1)}/hr</strong></Text>
              </Group>
              {backtestReport.warning && (
                <Text size="sm" c="orange" fw={600}>{backtestReport.warning}</Text>
              )}
            </Card>
          )}
        </Card>
      )}

      {/* ── Validator Gap Analysis (Expert) ────────────────────── */}
      {tab === "gaps" && expertMode && (
        <Card withBorder radius="md" p="md" className="ag-card-tier-1">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Validator Gap Analysis</Text>
            <Button size="xs" variant="light" onClick={handleGapAnalysis}>Run Analysis</Button>
          </Group>
          {gapReport && (
            <>
              <Group gap="lg" mb="md">
                <Text size="sm">Validator passes: <strong>{gapReport.totalValidatorPasses}</strong></Text>
                <Text size="sm">Human-rejected after pass: <strong>{gapReport.humanRejectedAfterPass}</strong></Text>
                <Text size="sm">Gap rate: <strong>{pct(gapReport.gapRate)}</strong></Text>
              </Group>
              {gapReport.suggestions.length > 0 && (
                <Card withBorder p="sm" radius="sm" mb="sm" className="ag-card-tier-2">
                  <Text fw={600} size="sm" mb="xs">Suggestions</Text>
                  <Stack gap={4}>
                    {gapReport.suggestions.map((s, i) => (
                      <Text key={i} size="xs">{s}</Text>
                    ))}
                  </Stack>
                </Card>
              )}
              {gapReport.entries.length > 0 && (
                <ScrollArea>
                  <Table className="ag-trend-table" striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Asset</Table.Th>
                        <Table.Th>Check</Table.Th>
                        <Table.Th>Score</Table.Th>
                        <Table.Th>Threshold</Table.Th>
                        <Table.Th>Suggested Action</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {gapReport.entries.map((e, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{e.assetId}</Table.Td>
                          <Table.Td>{e.checkId ?? "—"}</Table.Td>
                          <Table.Td>{e.checkScore?.toFixed(2) ?? "—"}</Table.Td>
                          <Table.Td>{e.checkThreshold?.toFixed(2) ?? "—"}</Table.Td>
                          <Table.Td><Text size="xs" lineClamp={2}>{e.suggestedAction ?? "—"}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </>
          )}
        </Card>
      )}
    </Stack>
  );
}
