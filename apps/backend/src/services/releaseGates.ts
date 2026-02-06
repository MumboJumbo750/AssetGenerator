import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { readJson, writeJsonAtomic, fileExists } from "../lib/json";
import { loadAllEvents, safeReadAllJson, countJsonFiles } from "../lib/projectData";
import type { SchemaRegistry } from "../lib/schemas";

// ── Types ─────────────────────────────────────────────────────────────

export type GateStatus = "pass" | "fail" | "insufficient_data";

export type GateResult = {
  id: string;
  name: string;
  threshold: string;
  measured: number | null;
  unit: string;
  status: GateStatus;
  detail: string;
};

export type BenchmarkProfile = {
  targetJobs: number;
  targetAssets: number;
  targetSpecs: number;
  targetAutomationRules: number;
  actualJobs: number;
  actualAssets: number;
  actualSpecs: number;
  actualAutomationRules: number;
  satisfied: boolean;
  warmCacheJobsListMs?: number;
  coldCacheJobsListMs?: number;
};

export type ReleaseGateReport = {
  id: string;
  projectId: string;
  createdAt: string;
  overallStatus: GateStatus;
  benchmarkProfile: BenchmarkProfile;
  gates: GateResult[];
};

// ── Benchmark targets (from Section 9) ────────────────────────────────

const BENCHMARK_TARGETS = {
  targetJobs: 2000,
  targetAssets: 500,
  targetSpecs: 300,
  targetAutomationRules: 50,
};

function nowIso() {
  return new Date().toISOString();
}

// ── Gate Evaluation ───────────────────────────────────────────────────

/**
 * Evaluate all 9 release gates from Section 9 and produce a signed report.
 */
export async function evaluateReleaseGates(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
}): Promise<ReleaseGateReport> {
  const projectDir = path.join(opts.projectsRoot, opts.projectId);

  // Count project entities for benchmark profile
  const jobCount = await countJsonFiles(path.join(projectDir, "jobs"));
  const assetCount = await countJsonFiles(path.join(projectDir, "assets"));
  const specCount = await countJsonFiles(path.join(projectDir, "specs"));
  const ruleCount = await countJsonFiles(path.join(projectDir, "automation-rules"));

  // Measure warm/cold cache jobs-list latency
  // Cold cache: first read (no OS page-cache benefit assumed)
  // Warm cache: second read (same process, data likely in OS page cache)
  const coldStart = performance.now();
  await safeReadAllJson(path.join(projectDir, "jobs"));
  const coldCacheJobsListMs = performance.now() - coldStart;

  const warmStart = performance.now();
  await safeReadAllJson(path.join(projectDir, "jobs"));
  const warmCacheJobsListMs = performance.now() - warmStart;

  const benchmarkProfile: BenchmarkProfile = {
    ...BENCHMARK_TARGETS,
    actualJobs: jobCount,
    actualAssets: assetCount,
    actualSpecs: specCount,
    actualAutomationRules: ruleCount,
    satisfied:
      jobCount >= BENCHMARK_TARGETS.targetJobs &&
      assetCount >= BENCHMARK_TARGETS.targetAssets &&
      specCount >= BENCHMARK_TARGETS.targetSpecs &&
      ruleCount >= BENCHMARK_TARGETS.targetAutomationRules,
    warmCacheJobsListMs: Math.round(warmCacheJobsListMs),
    coldCacheJobsListMs: Math.round(coldCacheJobsListMs),
  };

  // Load events + trend data for gate measurements
  const events = await loadAllEvents(projectDir);
  const latestTrend = await getLatestTrendSnapshot(opts.projectsRoot, opts.projectId);
  const validationResults = await safeReadAllJson<{
    status?: string;
    checks?: Array<{ checkId?: string; status?: string; score?: number }>;
  }>(path.join(projectDir, "baseline-validation-results"));

  // Compute jobs
  const jobs = await safeReadAllJson<{
    id?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    escalatedAt?: string;
    escalationTarget?: string;
    errorClass?: string;
  }>(path.join(projectDir, "jobs"));

  const gates: GateResult[] = [];

  // ── Gate 1: Deterministic stack reproducibility >= 99% ──────────────
  // Measure from replay events: look for duplicate_detected / replay_mismatch counts
  const replayEvents = events.filter((e) => e.type === "replay_test_completed" || e.type === "replay_test_result");
  let gate1Measured: number | null = null;
  let gate1Status: GateStatus = "insufficient_data";
  if (replayEvents.length > 0) {
    const passed = replayEvents.filter((e) => (e.payload as any)?.pass === true).length;
    gate1Measured = passed / replayEvents.length;
    gate1Status = gate1Measured >= 0.99 ? "pass" : "fail";
  }
  gates.push({
    id: "deterministic_stack_reproducibility",
    name: "Deterministic stack reproducibility",
    threshold: ">= 99%",
    measured: gate1Measured,
    unit: "%",
    status: gate1Status,
    detail:
      gate1Measured !== null
        ? `${(gate1Measured * 100).toFixed(1)}% of ${replayEvents.length} replay tests passed`
        : "No replay test events found",
  });

  // ── Gate 2: First-pass validator success >= 85% ─────────────────────
  let gate2Measured: number | null = null;
  let gate2Status: GateStatus = "insufficient_data";
  if (validationResults.length > 0) {
    const passed = validationResults.filter((vr) => vr.status === "pass").length;
    gate2Measured = passed / validationResults.length;
    gate2Status = gate2Measured >= 0.85 ? "pass" : "fail";
  }
  gates.push({
    id: "first_pass_validator_success",
    name: "First-pass validator success",
    threshold: ">= 85%",
    measured: gate2Measured,
    unit: "%",
    status: gate2Status,
    detail:
      gate2Measured !== null
        ? `${(gate2Measured * 100).toFixed(1)}% of ${validationResults.length} validations passed`
        : "No validation results found",
  });

  // ── Gate 3: Event delivery latency (worker->frontend) p95 <= 1.5s ──
  const deliveryEvents = events.filter(
    (e) => e.type === "event_delivered" && (e.payload as any)?.deliveryLatencyMs != null,
  );
  let gate3Measured: number | null = null;
  let gate3Status: GateStatus = "insufficient_data";
  if (deliveryEvents.length > 0) {
    const latencies = deliveryEvents.map((e) => (e.payload as any).deliveryLatencyMs as number).sort((a, b) => a - b);
    const p95idx = Math.ceil(latencies.length * 0.95) - 1;
    gate3Measured = latencies[p95idx];
    gate3Status = gate3Measured <= 1500 ? "pass" : "fail";
  }
  gates.push({
    id: "event_delivery_latency_p95",
    name: "Event delivery latency p95",
    threshold: "<= 1500 ms",
    measured: gate3Measured,
    unit: "ms",
    status: gate3Status,
    detail:
      gate3Measured !== null
        ? `p95 = ${gate3Measured.toFixed(0)} ms across ${deliveryEvents.length} deliveries`
        : "No event delivery telemetry found",
  });

  // ── Gate 4: Jobs list API latency p95 <= 200ms ─────────────────────
  const apiLatencyEvents = events.filter(
    (e) => e.type === "api_latency_sample" && (e.payload as any)?.endpoint === "jobs_list",
  );
  let gate4Measured: number | null = null;
  let gate4Status: GateStatus = "insufficient_data";
  if (apiLatencyEvents.length > 0) {
    const latencies = apiLatencyEvents.map((e) => (e.payload as any).durationMs as number).sort((a, b) => a - b);
    const p95idx = Math.ceil(latencies.length * 0.95) - 1;
    gate4Measured = latencies[p95idx];
    gate4Status = gate4Measured <= 200 ? "pass" : "fail";
  }
  gates.push({
    id: "jobs_list_api_latency_p95",
    name: "Jobs list API latency p95",
    threshold: "<= 200 ms",
    measured: gate4Measured,
    unit: "ms",
    status: gate4Status,
    detail:
      gate4Measured !== null
        ? `p95 = ${gate4Measured.toFixed(0)} ms across ${apiLatencyEvents.length} samples`
        : "No API latency telemetry found",
  });

  // ── Gate 5: Decision Sprint throughput >= 6 assets/min ─────────────
  const sprintEvents = events.filter((e) => e.type === "decision_sprint_answer" || e.type === "decision_made");
  let gate5Measured: number | null = null;
  let gate5Status: GateStatus = "insufficient_data";
  if (sprintEvents.length >= 2) {
    const timestamps = sprintEvents.map((e) => Date.parse(e.ts)).sort((a, b) => a - b);
    const durationMin = (timestamps[timestamps.length - 1] - timestamps[0]) / 60_000;
    if (durationMin > 0) {
      gate5Measured = sprintEvents.length / durationMin;
      gate5Status = gate5Measured >= 6 ? "pass" : "fail";
    }
  }
  gates.push({
    id: "decision_sprint_throughput",
    name: "Decision Sprint throughput",
    threshold: ">= 6 assets/min",
    measured: gate5Measured,
    unit: "assets/min",
    status: gate5Status,
    detail:
      gate5Measured !== null
        ? `${gate5Measured.toFixed(1)} assets/min across ${sprintEvents.length} decisions`
        : "Insufficient decision sprint data",
  });

  // ── Gate 6: Auto-resolved decisions >= 60% ─────────────────────────
  const decisionEvents = events.filter((e) => e.type === "decision_made" || e.type === "decision_sprint_answer");
  let gate6Measured: number | null = null;
  let gate6Status: GateStatus = "insufficient_data";
  if (decisionEvents.length > 0) {
    const autoResolved = decisionEvents.filter((e) => (e.payload as any)?.auto === true).length;
    gate6Measured = autoResolved / decisionEvents.length;
    gate6Status = gate6Measured >= 0.6 ? "pass" : "fail";
  }
  gates.push({
    id: "auto_resolved_decisions",
    name: "Auto-resolved decisions",
    threshold: ">= 60%",
    measured: gate6Measured,
    unit: "%",
    status: gate6Status,
    detail:
      gate6Measured !== null
        ? `${(gate6Measured * 100).toFixed(1)}% of ${decisionEvents.length} decisions auto-resolved`
        : "No decision events found",
  });

  // ── Gate 7: Cross-output entity cohesion score above project threshold
  // Read per-project cohesion threshold from project.json; default 0.7
  let cohesionThreshold = 0.7;
  const projectJsonPath = path.join(projectDir, "project.json");
  try {
    if (await fileExists(projectJsonPath)) {
      const proj = await readJson<{ cohesionThreshold?: number }>(projectJsonPath);
      if (typeof proj.cohesionThreshold === "number") cohesionThreshold = proj.cohesionThreshold;
    }
  } catch {
    // use default
  }

  let gate7Measured: number | null = latestTrend?.metrics?.cohesionScore ?? null;
  let gate7Status: GateStatus = "insufficient_data";
  if (gate7Measured !== null) {
    gate7Status = gate7Measured >= cohesionThreshold ? "pass" : "fail";
  }
  gates.push({
    id: "cross_output_entity_cohesion",
    name: "Cross-output entity cohesion score",
    threshold: `>= ${cohesionThreshold}`,
    measured: gate7Measured,
    unit: "score",
    status: gate7Status,
    detail:
      gate7Measured !== null
        ? `Cohesion score = ${gate7Measured.toFixed(3)} (threshold ${cohesionThreshold})`
        : "No cohesion score data available",
  });

  // ── Gate 8: Duplicate-action rate from event replay <= 0.1% ────────
  const duplicateEvents = events.filter(
    (e) => e.type === "idempotency_duplicate_blocked" || e.type === "duplicate_action_blocked",
  );
  let gate8Measured: number | null = null;
  let gate8Status: GateStatus = "insufficient_data";
  if (events.length > 0) {
    gate8Measured = events.length > 0 ? duplicateEvents.length / events.length : 0;
    gate8Status = gate8Measured <= 0.001 ? "pass" : "fail";
  }
  gates.push({
    id: "duplicate_action_rate",
    name: "Duplicate-action rate",
    threshold: "<= 0.1%",
    measured: gate8Measured,
    unit: "%",
    status: gate8Status,
    detail:
      gate8Measured !== null
        ? `${(gate8Measured * 100).toFixed(3)}% (${duplicateEvents.length}/${events.length} events)`
        : "No event data",
  });

  // ── Gate 9: Checkpoint switch replay tests pass with copax & pony ──
  const REQUIRED_PROFILES = ["copax", "pony"];
  const checkpointReplayEvents = events.filter(
    (e) => e.type === "checkpoint_switch_replay_test" || e.type === "checkpoint_replay_result",
  );
  let gate9Measured: number | null = null;
  let gate9Status: GateStatus = "insufficient_data";
  let gate9Detail = "No checkpoint replay test data found";

  if (checkpointReplayEvents.length > 0) {
    // Verify both required profiles are represented
    const profilesCovered = new Set<string>();
    for (const e of checkpointReplayEvents) {
      const profile = (e.payload as any)?.profileId ?? (e.payload as any)?.checkpointId;
      if (typeof profile === "string") {
        const lc = profile.toLowerCase();
        for (const rp of REQUIRED_PROFILES) {
          if (lc.includes(rp)) profilesCovered.add(rp);
        }
      }
    }

    const passed = checkpointReplayEvents.filter((e) => (e.payload as any)?.pass === true).length;
    gate9Measured = passed / checkpointReplayEvents.length;
    const allProfilesCovered = REQUIRED_PROFILES.every((p) => profilesCovered.has(p));
    const profileStatus = `copax: ${profilesCovered.has("copax") ? "yes" : "no"}, pony: ${profilesCovered.has("pony") ? "yes" : "no"}`;

    if (!allProfilesCovered) {
      const missing = REQUIRED_PROFILES.filter((p) => !profilesCovered.has(p));
      gate9Status = "fail";
      gate9Detail = `Missing profiles: ${missing.join(", ")}. ${(gate9Measured * 100).toFixed(1)}% of ${checkpointReplayEvents.length} tests passed (${profileStatus})`;
    } else {
      gate9Status = gate9Measured >= 1.0 ? "pass" : "fail";
      gate9Detail = `${(gate9Measured * 100).toFixed(1)}% of ${checkpointReplayEvents.length} tests passed (${profileStatus})`;
    }
  }

  gates.push({
    id: "checkpoint_switch_replay",
    name: "Checkpoint switch replay tests",
    threshold: "100% pass (copax, pony)",
    measured: gate9Measured,
    unit: "%",
    status: gate9Status,
    detail: gate9Detail,
  });

  // ── Overall status ─────────────────────────────────────────────────
  const hasInsufficient = gates.some((g) => g.status === "insufficient_data");
  const hasFail = gates.some((g) => g.status === "fail");
  const overallStatus: GateStatus = hasFail ? "fail" : hasInsufficient ? "insufficient_data" : "pass";

  const id = ulid();
  const report: ReleaseGateReport = {
    id,
    projectId: opts.projectId,
    createdAt: nowIso(),
    overallStatus,
    benchmarkProfile,
    gates,
  };

  opts.schemas.validateOrThrow("release-gate-report.schema.json", report);
  const filePath = path.join(opts.projectsRoot, opts.projectId, "release-gate-reports", `${id}.json`);
  await writeJsonAtomic(filePath, report);
  return report;
}

// ── List / Get reports ────────────────────────────────────────────────

export async function listReleaseGateReports(
  projectsRoot: string,
  projectId: string,
  opts?: { limit?: number },
): Promise<ReleaseGateReport[]> {
  const dir = path.join(projectsRoot, projectId, "release-gate-reports");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let items: ReleaseGateReport[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<ReleaseGateReport>(path.join(dir, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (opts?.limit) items = items.slice(0, opts.limit);
    return items;
  } catch {
    return [];
  }
}

export async function getReleaseGateReport(
  projectsRoot: string,
  projectId: string,
  reportId: string,
): Promise<ReleaseGateReport | null> {
  const fp = path.join(projectsRoot, projectId, "release-gate-reports", `${reportId}.json`);
  try {
    return await readJson<ReleaseGateReport>(fp);
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

async function getLatestTrendSnapshot(
  projectsRoot: string,
  projectId: string,
): Promise<{
  metrics?: {
    cohesionScore?: number;
    driftScore?: number;
    autoResolvedRate?: number;
    firstPassApprovalRate?: number;
  };
} | null> {
  const dir = path.join(projectsRoot, projectId, "trend-snapshots");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const jsonFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));
    if (jsonFiles.length === 0) return null;
    let latest: any = null;
    for (const f of jsonFiles) {
      const snap = await readJson<any>(path.join(dir, f.name));
      if (!latest || (snap.createdAt && snap.createdAt > latest.createdAt)) {
        latest = snap;
      }
    }
    return latest;
  } catch {
    return null;
  }
}
