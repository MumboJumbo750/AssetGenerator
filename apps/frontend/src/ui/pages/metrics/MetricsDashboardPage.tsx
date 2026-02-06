import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Progress,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";

import { useAppData } from "../../context/AppDataContext";
import {
  generateMetricsSnapshot,
  listMetricsSnapshots,
  evaluateReleaseGates,
  listReleaseGateReports,
  type MetricsSnapshotRecord,
  type ReleaseGateReport,
  type GateResult,
} from "../../api";

/* ── Helpers ───────────────────────────────────────────────────────── */

function pct(n?: number): string {
  if (n === undefined || n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function num(n?: number | null): string {
  if (n === undefined || n === null) return "—";
  return String(Math.round(n));
}

function relTime(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function gateColor(status: string): string {
  if (status === "pass") return "green";
  if (status === "fail") return "red";
  return "gray";
}

function overallColor(status: string): string {
  if (status === "pass") return "green";
  if (status === "fail") return "red";
  return "yellow";
}

/* ── Component ─────────────────────────────────────────────────────── */

export function MetricsDashboardPage() {
  const { selectedProjectId } = useAppData();
  const [snapshot, setSnapshot] = useState<MetricsSnapshotRecord | null>(null);
  const [gateReport, setGateReport] = useState<ReleaseGateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const [metricsRes, gatesRes] = await Promise.all([
        listMetricsSnapshots(selectedProjectId, { limit: 1 }),
        listReleaseGateReports(selectedProjectId, { limit: 1 }),
      ]);
      setSnapshot(metricsRes.snapshots[0] ?? null);
      setGateReport(gatesRes.reports[0] ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    }
  }, [selectedProjectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleGenerateMetrics = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateMetricsSnapshot(selectedProjectId);
      setSnapshot(res.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate metrics");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  const handleEvaluateGates = useCallback(async () => {
    if (!selectedProjectId) return;
    setGateLoading(true);
    setError(null);
    try {
      const res = await evaluateReleaseGates(selectedProjectId);
      setGateReport(res.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate gates");
    } finally {
      setGateLoading(false);
    }
  }, [selectedProjectId]);

  if (!selectedProjectId) {
    return (
      <Stack gap="lg">
        <Title order={3}>Metrics & Quality Gates</Title>
        <Text c="dimmed">Select a project first.</Text>
      </Stack>
    );
  }

  const m = snapshot?.metrics;

  return (
    <ScrollArea style={{ height: "100%" }}>
      <Stack gap="lg" p="md">
        <Group justify="space-between">
          <div>
            <Title order={3}>Metrics & Quality Gates</Title>
            <Text size="sm" c="dimmed">
              Section 9 operational dashboard and release gate evaluation.
            </Text>
          </div>
          <Group gap="xs">
            <Button size="xs" variant="light" loading={loading} onClick={handleGenerateMetrics}>
              Collect Metrics
            </Button>
            <Button size="xs" variant="filled" loading={gateLoading} onClick={handleEvaluateGates}>
              Evaluate Release Gates
            </Button>
          </Group>
        </Group>

        {error && (
          <Card withBorder radius="md" p="sm" bg="red.9">
            <Text size="sm" c="white">
              {error}
            </Text>
          </Card>
        )}

        {/* ── Release Gate Status ───────────────────────────────────── */}
        {gateReport && (
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={700} size="lg">
                  Release Gate Status
                </Text>
                <Group gap="xs">
                  <Badge size="lg" color={overallColor(gateReport.overallStatus)} variant="filled">
                    {gateReport.overallStatus.toUpperCase()}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {relTime(gateReport.createdAt)}
                  </Text>
                </Group>
              </Group>

              {/* Benchmark profile bar */}
              <Card withBorder radius="sm" p="xs" bg="dark.7">
                <Group justify="space-between" mb={4}>
                  <Text size="sm" fw={600}>
                    Benchmark Profile
                  </Text>
                  <Badge size="sm" color={gateReport.benchmarkProfile.satisfied ? "green" : "orange"}>
                    {gateReport.benchmarkProfile.satisfied ? "Satisfied" : "Below Target"}
                  </Badge>
                </Group>
                <BenchmarkBar
                  label="Jobs"
                  actual={gateReport.benchmarkProfile.actualJobs}
                  target={gateReport.benchmarkProfile.targetJobs}
                />
                <BenchmarkBar
                  label="Assets"
                  actual={gateReport.benchmarkProfile.actualAssets}
                  target={gateReport.benchmarkProfile.targetAssets}
                />
                <BenchmarkBar
                  label="Specs"
                  actual={gateReport.benchmarkProfile.actualSpecs}
                  target={gateReport.benchmarkProfile.targetSpecs}
                />
                <BenchmarkBar
                  label="Rules"
                  actual={gateReport.benchmarkProfile.actualAutomationRules}
                  target={gateReport.benchmarkProfile.targetAutomationRules}
                />
                {(gateReport.benchmarkProfile.warmCacheJobsListMs != null ||
                  gateReport.benchmarkProfile.coldCacheJobsListMs != null) && (
                  <Group gap="md" mt="xs">
                    <Text size="xs" c="dimmed">
                      Cache measurements:
                    </Text>
                    {gateReport.benchmarkProfile.coldCacheJobsListMs != null && (
                      <Badge size="sm" variant="light" color="blue">
                        Cold: {gateReport.benchmarkProfile.coldCacheJobsListMs} ms
                      </Badge>
                    )}
                    {gateReport.benchmarkProfile.warmCacheJobsListMs != null && (
                      <Badge size="sm" variant="light" color="green">
                        Warm: {gateReport.benchmarkProfile.warmCacheJobsListMs} ms
                      </Badge>
                    )}
                  </Group>
                )}
              </Card>

              {/* Gate detail table */}
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Gate</Table.Th>
                    <Table.Th>Threshold</Table.Th>
                    <Table.Th>Measured</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Detail</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {gateReport.gates.map((g: GateResult) => (
                    <Table.Tr key={g.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {g.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{g.threshold}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {g.measured !== null
                            ? g.unit === "%"
                              ? pct(g.measured)
                              : g.unit === "score"
                                ? g.measured.toFixed(3)
                                : g.unit === "assets/min"
                                  ? g.measured.toFixed(1)
                                  : `${Math.round(g.measured)} ${g.unit}`
                            : "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={gateColor(g.status)}>
                          {g.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {g.detail}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        )}

        {/* ── Operational Metrics ───────────────────────────────────── */}
        {snapshot ? (
          <>
            <Card withBorder radius="md" p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700} size="lg">
                    Spec Readiness
                  </Text>
                  <Text size="xs" c="dimmed">
                    {relTime(snapshot.createdAt)}
                  </Text>
                </Group>
                <Group grow>
                  <MetricCard label="Autopilot Ready" value={pct(m?.autopilotReadySpecsPct)} />
                  <MetricCard label="Complete Contracts" value={pct(m?.completeContractSpecsPct)} />
                  <MetricCard label="Checkpoint Compatible" value={pct(m?.checkpointCompatibleSpecsPct)} />
                </Group>
              </Stack>
            </Card>

            <Group grow align="stretch">
              <Card withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Text fw={700}>Exception Queue</Text>
                  <Group grow>
                    <MetricCard label="Volume" value={num(m?.exceptionQueueVolume)} />
                    <MetricCard
                      label="Median Age"
                      value={
                        m?.exceptionQueueAgingHours !== undefined ? `${m.exceptionQueueAgingHours.toFixed(1)}h` : "—"
                      }
                    />
                  </Group>
                </Stack>
              </Card>

              <Card withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Text fw={700}>Automation & Latency</Text>
                  <Group grow>
                    <MetricCard
                      label="Trigger→Run"
                      value={
                        m?.automationTriggerToRunLatencyMs != null
                          ? `${num(m.automationTriggerToRunLatencyMs)} ms`
                          : "—"
                      }
                    />
                    <MetricCard
                      label="LoRA→Approval"
                      value={
                        m?.loraActivationToApprovalHours != null
                          ? `${m.loraActivationToApprovalHours.toFixed(1)}h`
                          : "—"
                      }
                    />
                  </Group>
                </Stack>
              </Card>
            </Group>

            <Group grow align="stretch">
              <Card withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Text fw={700}>Idempotency & Profile</Text>
                  <Group grow>
                    <MetricCard label="Dedupe Hit Rate" value={pct(m?.idempotencyDedupeHitRate)} />
                    <MetricCard label="Profile Drift Violations" value={num(m?.pinnedProfileDriftViolations)} />
                  </Group>
                </Stack>
              </Card>

              <Card withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Text fw={700}>Validator Fail Categories</Text>
                  {m?.validatorFailCategoryDistribution &&
                  Object.keys(m.validatorFailCategoryDistribution).length > 0 ? (
                    <Table withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Category</Table.Th>
                          <Table.Th>Count</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {Object.entries(m.validatorFailCategoryDistribution)
                          .sort(([, a], [, b]) => b - a)
                          .map(([cat, count]) => (
                            <Table.Tr key={cat}>
                              <Table.Td>
                                <Text size="sm">{cat}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{count}</Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No validator failures recorded.
                    </Text>
                  )}
                </Stack>
              </Card>
            </Group>

            {/* Escalation reason distribution */}
            <Card withBorder radius="md" p="md">
              <Stack gap="sm">
                <Text fw={700}>Escalation Reason Distribution</Text>
                {m?.escalationReasonCodeDistribution && Object.keys(m.escalationReasonCodeDistribution).length > 0 ? (
                  <Group gap="xs" wrap="wrap">
                    {Object.entries(m.escalationReasonCodeDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count]) => (
                        <Badge key={reason} variant="light" color="orange" size="lg">
                          {reason}: {count}
                        </Badge>
                      ))}
                  </Group>
                ) : (
                  <Text size="sm" c="dimmed">
                    No escalations recorded.
                  </Text>
                )}
              </Stack>
            </Card>

            {/* Prompt compile drift by checkpoint */}
            <Group grow align="stretch">
              <Card withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Text fw={700}>Prompt Compile Drift by Checkpoint</Text>
                  {m?.promptCompileDriftByCheckpoint && Object.keys(m.promptCompileDriftByCheckpoint).length > 0 ? (
                    <Table withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Checkpoint</Table.Th>
                          <Table.Th>Drift</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {Object.entries(m.promptCompileDriftByCheckpoint)
                          .sort(([, a], [, b]) => b - a)
                          .map(([cp, drift]) => (
                            <Table.Tr key={cp}>
                              <Table.Td>
                                <Text size="sm">{cp}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge size="sm" color={drift > 0.2 ? "red" : drift > 0.05 ? "yellow" : "green"}>
                                  {pct(drift)}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No compile trace data.
                    </Text>
                  )}
                </Stack>
              </Card>

              {/* Prompt compile drift by tag family */}
              <Card withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Text fw={700}>Prompt Compile Drift by Tag Family</Text>
                  {m?.promptCompileDriftByTagFamily && Object.keys(m.promptCompileDriftByTagFamily).length > 0 ? (
                    <Table withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Tag Family</Table.Th>
                          <Table.Th>Drift</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {Object.entries(m.promptCompileDriftByTagFamily)
                          .sort(([, a], [, b]) => b - a)
                          .map(([tf, drift]) => (
                            <Table.Tr key={tf}>
                              <Table.Td>
                                <Text size="sm">{tf}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge size="sm" color={drift > 0.2 ? "red" : drift > 0.05 ? "yellow" : "green"}>
                                  {pct(drift)}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No tag family drift data.
                    </Text>
                  )}
                </Stack>
              </Card>
            </Group>
          </>
        ) : (
          <Card withBorder radius="md" p="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed">No metrics snapshot yet.</Text>
              <Button size="sm" variant="light" loading={loading} onClick={handleGenerateMetrics}>
                Collect First Snapshot
              </Button>
            </Stack>
          </Card>
        )}
      </Stack>
    </ScrollArea>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder radius="sm" p="xs" bg="dark.7">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="lg">
        {value}
      </Text>
    </Card>
  );
}

function BenchmarkBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pctVal = Math.min(100, (actual / target) * 100);
  const color = actual >= target ? "green" : actual >= target * 0.5 ? "yellow" : "red";
  return (
    <Group gap="xs" mt={2}>
      <Text size="xs" w={50}>
        {label}
      </Text>
      <Tooltip label={`${actual} / ${target}`}>
        <Progress value={pctVal} color={color} size="sm" style={{ flex: 1 }} />
      </Tooltip>
      <Text size="xs" c="dimmed" w={70} ta="right">
        {actual}/{target}
      </Text>
    </Group>
  );
}
