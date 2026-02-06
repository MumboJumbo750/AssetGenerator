import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

// ── Types ─────────────────────────────────────────────────────────────

export type TrendSnapshot = {
  id: string;
  projectId: string;
  period: {
    from: string;
    to: string;
    granularity: "hourly" | "daily" | "weekly";
  };
  scope?: {
    checkpointId?: string;
    assetType?: string;
    entityFamily?: string;
    tag?: string;
  };
  metrics: TrendMetrics;
  createdAt: string;
};

export type TrendMetrics = {
  totalJobs?: number;
  succeededJobs?: number;
  failedJobs?: number;
  totalAssets?: number;
  approvedAssets?: number;
  rejectedAssets?: number;
  firstPassApprovalRate?: number;
  validatorPassRate?: number;
  avgValidatorScore?: number;
  escalationCount?: number;
  autoResolvedDecisions?: number;
  manualDecisions?: number;
  autoResolvedRate?: number;
  avgJobDurationMs?: number;
  cohesionScore?: number;
  driftScore?: number;
  validatorGapCount?: number;
  validatorGapRate?: number;
};

type ProjectEvent = {
  id: string;
  projectId: string;
  seq: number;
  ts: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listTrendSnapshots(
  projectsRoot: string,
  projectId: string,
  opts?: { granularity?: string; limit?: number },
): Promise<TrendSnapshot[]> {
  const dir = path.join(projectsRoot, projectId, "trend-snapshots");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let items: TrendSnapshot[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<TrendSnapshot>(path.join(dir, e.name)));
    }
    if (opts?.granularity) {
      items = items.filter((s) => s.period.granularity === opts.granularity);
    }
    items.sort((a, b) => b.period.to.localeCompare(a.period.to));
    if (opts?.limit) items = items.slice(0, opts.limit);
    return items;
  } catch {
    return [];
  }
}

export async function getTrendSnapshot(
  projectsRoot: string,
  projectId: string,
  snapshotId: string,
): Promise<TrendSnapshot | null> {
  const filePath = path.join(projectsRoot, projectId, "trend-snapshots", `${snapshotId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<TrendSnapshot>(filePath);
}

// ── Snapshot Generation ───────────────────────────────────────────────

/**
 * Generate a trend snapshot for a time period by aggregating events,
 * job files, asset files, and validation results.
 */
export async function generateTrendSnapshot(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  from: string;
  to: string;
  granularity: "hourly" | "daily" | "weekly";
  scope?: TrendSnapshot["scope"];
}): Promise<TrendSnapshot> {
  const projectDir = path.join(opts.projectsRoot, opts.projectId);
  const scope = opts.scope;

  // Load events in period, filtered by scope
  let events = await loadPeriodEvents(projectDir, opts.from, opts.to);
  if (scope) {
    events = events.filter((e) => matchesScope(e, scope));
  }

  // Compute job metrics from events
  const jobEvents = events.filter((e) => e.entityType === "job");
  const succeededJobs = jobEvents.filter((e) => e.type === "job_succeeded").length;
  const failedJobs = jobEvents.filter((e) => e.type === "job_failed").length;
  const totalJobs = succeededJobs + failedJobs;

  // Compute asset metrics from events
  const assetEvents = events.filter((e) => e.entityType === "asset" || e.entityType === "asset_version");
  const approvedAssets = assetEvents.filter(
    (e) => e.type === "asset_approved" || (e.payload as any)?.status === "approved",
  ).length;
  const rejectedAssets = assetEvents.filter(
    (e) => e.type === "asset_rejected" || (e.payload as any)?.status === "rejected",
  ).length;
  const totalAssets = approvedAssets + rejectedAssets;

  // Decision metrics
  const decisionEvents = events.filter((e) => e.type === "decision_made" || e.type === "decision_sprint_answer");
  const autoResolved = decisionEvents.filter((e) => (e.payload as any)?.auto === true).length;
  const manualDecisions = decisionEvents.length - autoResolved;

  // Escalation count
  const escalationCount = events.filter(
    (e) => e.type === "job_escalated" || (e.payload as any)?.escalated === true,
  ).length;

  // Compute validator metrics from validation results
  const validationDir = path.join(projectDir, "baseline-validation-results");
  let validatorPass = 0;
  let validatorTotal = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  try {
    const entries = await fs.readdir(validationDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const result = await readJson<{
        createdAt?: string;
        status?: string;
        specId?: string;
        assetType?: string;
        checkpointId?: string;
        entityFamily?: string;
        checks?: Array<{ score?: number }>;
      }>(path.join(validationDir, e.name));
      if (result.createdAt && (result.createdAt < opts.from || result.createdAt > opts.to)) continue;
      if (scope?.checkpointId && result.checkpointId && result.checkpointId !== scope.checkpointId) continue;
      if (scope?.assetType && result.assetType && result.assetType !== scope.assetType) continue;
      if (scope?.entityFamily && result.entityFamily && result.entityFamily !== scope.entityFamily) continue;
      validatorTotal++;
      if (result.status === "pass") validatorPass++;
      for (const check of result.checks ?? []) {
        if (check.score !== undefined) {
          scoreSum += check.score;
          scoreCount++;
        }
      }
    }
  } catch {
    // no validation results
  }

  // Validator gap: count pass-but-rejected
  const validatorGapCount = events.filter(
    (e) =>
      e.type === "validator_gap_detected" || ((e.payload as any)?.validatorPassed && (e.payload as any)?.humanRejected),
  ).length;

  // Compute cohesion and drift scores from validation result check scores.
  // Cohesion = 1 - stddev of per-check scores (higher = more consistent quality).
  // Drift = fraction of current-period scores that are below the PREVIOUS period average
  //   (a drop from historical baseline indicates drift; 0 = no drift, 1 = complete drift).
  let cohesionScore: number | undefined;
  let driftScore: number | undefined;
  if (scoreCount >= 2) {
    // Collect current-period check scores (reuse already-scanned validation results)
    const allScores: number[] = [];
    try {
      const vEntries = await fs.readdir(validationDir, { withFileTypes: true });
      for (const ve of vEntries) {
        if (!ve.isFile() || !ve.name.endsWith(".json")) continue;
        const vr = await readJson<{
          createdAt?: string;
          checkpointId?: string;
          assetType?: string;
          entityFamily?: string;
          checks?: Array<{ score?: number }>;
        }>(path.join(validationDir, ve.name));
        if (vr.createdAt && (vr.createdAt < opts.from || vr.createdAt > opts.to)) continue;
        if (scope?.checkpointId && vr.checkpointId && vr.checkpointId !== scope.checkpointId) continue;
        if (scope?.assetType && vr.assetType && vr.assetType !== scope.assetType) continue;
        if (scope?.entityFamily && vr.entityFamily && vr.entityFamily !== scope.entityFamily) continue;
        for (const ch of vr.checks ?? []) {
          if (ch.score !== undefined) allScores.push(ch.score);
        }
      }
    } catch {
      /* already handled */
    }

    if (allScores.length >= 2) {
      const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      const variance = allScores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / allScores.length;
      const stddev = Math.sqrt(variance);
      cohesionScore = Math.max(0, Math.min(1, 1 - stddev));

      // Compute drift by comparing against previous period of equal length
      const periodMs = Date.parse(opts.to) - Date.parse(opts.from);
      const prevFrom = new Date(Date.parse(opts.from) - periodMs).toISOString();
      const prevTo = opts.from;
      const prevScores: number[] = [];
      try {
        const vEntries2 = await fs.readdir(validationDir, { withFileTypes: true });
        for (const ve of vEntries2) {
          if (!ve.isFile() || !ve.name.endsWith(".json")) continue;
          const vr = await readJson<{
            createdAt?: string;
            checkpointId?: string;
            assetType?: string;
            entityFamily?: string;
            checks?: Array<{ score?: number }>;
          }>(path.join(validationDir, ve.name));
          if (!vr.createdAt || vr.createdAt < prevFrom || vr.createdAt >= prevTo) continue;
          if (scope?.checkpointId && vr.checkpointId && vr.checkpointId !== scope.checkpointId) continue;
          if (scope?.assetType && vr.assetType && vr.assetType !== scope.assetType) continue;
          if (scope?.entityFamily && vr.entityFamily && vr.entityFamily !== scope.entityFamily) continue;
          for (const ch of vr.checks ?? []) {
            if (ch.score !== undefined) prevScores.push(ch.score);
          }
        }
      } catch {
        /* no previous data */
      }

      if (prevScores.length >= 2) {
        const prevMean = prevScores.reduce((a, b) => a + b, 0) / prevScores.length;
        // Drift = fraction of current scores below the previous period's average
        const belowBaseline = allScores.filter((s) => s < prevMean).length;
        driftScore = belowBaseline / allScores.length;
      } else {
        // No previous data — no drift measurable
        driftScore = 0;
      }
    }
  }

  // Compute average job duration from job files (sample)
  let avgJobDurationMs = 0;
  const jobsDir = path.join(projectDir, "jobs");
  try {
    const jobEntries = await fs.readdir(jobsDir, { withFileTypes: true });
    let durationSum = 0;
    let durationCount = 0;
    for (const e of jobEntries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      if (durationCount >= 200) break; // sample limit
      const job = await readJson<{
        status?: string;
        createdAt?: string;
        updatedAt?: string;
      }>(path.join(jobsDir, e.name));
      if (job.status === "succeeded" && job.createdAt && job.updatedAt) {
        if (job.updatedAt >= opts.from && job.updatedAt <= opts.to) {
          durationSum += Date.parse(job.updatedAt) - Date.parse(job.createdAt);
          durationCount++;
        }
      }
    }
    if (durationCount > 0) avgJobDurationMs = durationSum / durationCount;
  } catch {
    // no jobs
  }

  const metrics: TrendMetrics = {
    totalJobs,
    succeededJobs,
    failedJobs,
    totalAssets,
    approvedAssets,
    rejectedAssets,
    firstPassApprovalRate: totalAssets > 0 ? approvedAssets / totalAssets : 0,
    validatorPassRate: validatorTotal > 0 ? validatorPass / validatorTotal : 0,
    avgValidatorScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
    escalationCount,
    autoResolvedDecisions: autoResolved,
    manualDecisions,
    autoResolvedRate: decisionEvents.length > 0 ? autoResolved / decisionEvents.length : 0,
    avgJobDurationMs,
    cohesionScore,
    driftScore,
    validatorGapCount,
    validatorGapRate: validatorTotal > 0 ? validatorGapCount / validatorTotal : 0,
  };

  const id = ulid();
  const snapshot: TrendSnapshot = {
    id,
    projectId: opts.projectId,
    period: { from: opts.from, to: opts.to, granularity: opts.granularity },
    scope: opts.scope,
    metrics,
    createdAt: nowIso(),
  };

  opts.schemas.validateOrThrow("trend-snapshot.schema.json", snapshot);
  const filePath = path.join(opts.projectsRoot, opts.projectId, "trend-snapshots", `${id}.json`);
  await writeJsonAtomic(filePath, snapshot);
  return snapshot;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Check if an event matches the requested scope filter.
 * Events carry scope hints in their payload.
 */
function matchesScope(event: ProjectEvent, scope: NonNullable<TrendSnapshot["scope"]>): boolean {
  const p = event.payload as Record<string, unknown>;
  if (scope.checkpointId && p.checkpointId && p.checkpointId !== scope.checkpointId) return false;
  if (scope.assetType && p.assetType && p.assetType !== scope.assetType) return false;
  if (scope.entityFamily && p.entityFamily && p.entityFamily !== scope.entityFamily) return false;
  if (scope.tag && p.tag && p.tag !== scope.tag) return false;
  return true;
}

async function loadPeriodEvents(projectDir: string, from: string, to: string): Promise<ProjectEvent[]> {
  const eventsPath = path.join(projectDir, "events.jsonl");
  const events: ProjectEvent[] = [];
  try {
    const content = await fs.readFile(eventsPath, "utf-8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as ProjectEvent;
        if (event.ts >= from && event.ts <= to) {
          events.push(event);
        }
      } catch {
        // skip malformed
      }
    }
  } catch {
    // no events file
  }
  return events;
}
