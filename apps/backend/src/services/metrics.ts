import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import { loadAllEvents, safeReadAllJson } from "../lib/projectData";
import type { SchemaRegistry } from "../lib/schemas";

// ── Types ─────────────────────────────────────────────────────────────

export type MetricsSnapshot = {
  id: string;
  projectId: string;
  createdAt: string;
  metrics: OperationalMetrics;
};

export type OperationalMetrics = {
  autopilotReadySpecsPct?: number;
  completeContractSpecsPct?: number;
  checkpointCompatibleSpecsPct?: number;
  validatorFailCategoryDistribution?: Record<string, number>;
  exceptionQueueVolume?: number;
  exceptionQueueAgingHours?: number;
  loraActivationToApprovalHours?: number | null;
  promptCompileDriftByCheckpoint?: Record<string, number>;
  promptCompileDriftByTagFamily?: Record<string, number>;
  automationTriggerToRunLatencyMs?: number | null;
  idempotencyDedupeHitRate?: number;
  escalationReasonCodeDistribution?: Record<string, number>;
  pinnedProfileDriftViolations?: number;
};

function nowIso() {
  return new Date().toISOString();
}

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listMetricsSnapshots(
  projectsRoot: string,
  projectId: string,
  opts?: { limit?: number },
): Promise<MetricsSnapshot[]> {
  const dir = path.join(projectsRoot, projectId, "metrics-snapshots");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let items: MetricsSnapshot[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<MetricsSnapshot>(path.join(dir, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (opts?.limit) items = items.slice(0, opts.limit);
    return items;
  } catch {
    return [];
  }
}

export async function getMetricsSnapshot(
  projectsRoot: string,
  projectId: string,
  snapshotId: string,
): Promise<MetricsSnapshot | null> {
  const filePath = path.join(projectsRoot, projectId, "metrics-snapshots", `${snapshotId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<MetricsSnapshot>(filePath);
}

// ── Snapshot Generation ───────────────────────────────────────────────

/**
 * Collect all Section-9 operational dashboard metrics by scanning project data.
 */
export async function generateMetricsSnapshot(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
}): Promise<MetricsSnapshot> {
  const projectDir = path.join(opts.projectsRoot, opts.projectId);

  const metrics: OperationalMetrics = {};

  // ── 1) Spec readiness metrics ───────────────────────────────────────
  const specsDir = path.join(projectDir, "specs");
  const specs = await safeReadAllJson<{
    id?: string;
    status?: string;
    checkpointId?: string;
    checkpointProfileId?: string;
    baselineProfileId?: string;
    loraPolicy?: { mode?: string };
    qualityContract?: Record<string, unknown>;
    promptPolicy?: Record<string, unknown>;
    seedPolicy?: Record<string, unknown>;
    entityLink?: Record<string, unknown>;
  }>(specsDir);

  if (specs.length > 0) {
    // Complete contract = has baselineProfileId + qualityContract + promptPolicy
    const completeContract = specs.filter((s) => s.baselineProfileId && s.qualityContract && s.promptPolicy).length;
    metrics.completeContractSpecsPct = completeContract / specs.length;

    // Checkpoint-compatible = has checkpointId + checkpointProfileId
    const cpCompat = specs.filter((s) => s.checkpointId && s.checkpointProfileId).length;
    metrics.checkpointCompatibleSpecsPct = cpCompat / specs.length;

    // Autopilot-ready = complete contract + checkpoint-compatible + status ready
    const autopilot = specs.filter(
      (s) =>
        s.baselineProfileId &&
        s.qualityContract &&
        s.promptPolicy &&
        s.checkpointId &&
        s.checkpointProfileId &&
        s.status === "ready",
    ).length;
    metrics.autopilotReadySpecsPct = autopilot / specs.length;
  }

  // ── 2) Validator fail category distribution ─────────────────────────
  const validationDir = path.join(projectDir, "baseline-validation-results");
  const validationResults = await safeReadAllJson<{
    status?: string;
    checks?: Array<{ checkId?: string; status?: string; score?: number }>;
  }>(validationDir);

  const failCats: Record<string, number> = {};
  for (const vr of validationResults) {
    for (const check of vr.checks ?? []) {
      if (check.status === "fail" && check.checkId) {
        failCats[check.checkId] = (failCats[check.checkId] ?? 0) + 1;
      }
    }
  }
  metrics.validatorFailCategoryDistribution = failCats;

  // ── 3) Exception queue volume + aging ───────────────────────────────
  const jobsDir = path.join(projectDir, "jobs");
  const jobs = await safeReadAllJson<{
    id?: string;
    status?: string;
    escalatedAt?: string;
    escalationTarget?: string;
    errorClass?: string;
    createdAt?: string;
    updatedAt?: string;
  }>(jobsDir);

  const escalatedJobs = jobs.filter(
    (j) => j.escalatedAt && j.escalationTarget === "exception_inbox" && j.status === "failed",
  );
  metrics.exceptionQueueVolume = escalatedJobs.length;

  if (escalatedJobs.length > 0) {
    const now = Date.now();
    const ages = escalatedJobs.map((j) => (now - Date.parse(j.escalatedAt!)) / 3_600_000).sort((a, b) => a - b);
    metrics.exceptionQueueAgingHours = ages[Math.floor(ages.length / 2)];
  } else {
    metrics.exceptionQueueAgingHours = 0;
  }

  // ── 4) LoRA activation to first approved output ─────────────────────
  // Scan events for lora_release_activated → first asset_approved per LoRA
  const events = await loadAllEvents(projectDir);
  const loraActivations = new Map<string, string>(); // loraId -> activation ts
  const loraFirstApproval = new Map<string, string>(); // loraId -> first approval ts

  for (const e of events) {
    if (e.type === "lora_release_activated" && e.entityId) {
      if (!loraActivations.has(e.entityId)) {
        loraActivations.set(e.entityId, e.ts);
      }
    }
    if ((e.type === "asset_approved" || (e.payload as any)?.status === "approved") && (e.payload as any)?.loraIds) {
      for (const lid of (e.payload as any).loraIds as string[]) {
        if (loraActivations.has(lid) && !loraFirstApproval.has(lid)) {
          loraFirstApproval.set(lid, e.ts);
        }
      }
    }
  }

  const activationDeltas: number[] = [];
  for (const [lid, activationTs] of loraActivations) {
    const approvalTs = loraFirstApproval.get(lid);
    if (approvalTs) {
      activationDeltas.push((Date.parse(approvalTs) - Date.parse(activationTs)) / 3_600_000);
    }
  }
  metrics.loraActivationToApprovalHours =
    activationDeltas.length > 0
      ? activationDeltas.sort((a, b) => a - b)[Math.floor(activationDeltas.length / 2)]
      : null;

  // ── 5) Prompt compile drift by checkpoint and tag family ─────────
  // Group compile trace hashes by checkpoint and tag family, measure fraction that changed
  const compileDrift: Record<string, number> = {};
  const compileDriftByTag: Record<string, number> = {};
  const compileTraceDir = path.join(projectDir, "compile-traces");
  const traces = await safeReadAllJson<{
    checkpointId?: string;
    tagFamily?: string;
    compileHash?: string;
    createdAt?: string;
  }>(compileTraceDir);

  const tracesByCheckpoint = new Map<string, string[]>();
  const tracesByTagFamily = new Map<string, string[]>();
  for (const t of traces) {
    if (!t.compileHash) continue;
    if (t.checkpointId) {
      let list = tracesByCheckpoint.get(t.checkpointId);
      if (!list) {
        list = [];
        tracesByCheckpoint.set(t.checkpointId, list);
      }
      list.push(t.compileHash);
    }
    if (t.tagFamily) {
      let list = tracesByTagFamily.get(t.tagFamily);
      if (!list) {
        list = [];
        tracesByTagFamily.set(t.tagFamily, list);
      }
      list.push(t.compileHash);
    }
  }

  function computeDrift(groups: Map<string, string[]>, out: Record<string, number>) {
    for (const [key, hashes] of groups) {
      if (hashes.length < 2) {
        out[key] = 0;
        continue;
      }
      const uniqueHashes = new Set(hashes);
      out[key] = (uniqueHashes.size - 1) / (hashes.length - 1);
    }
  }
  computeDrift(tracesByCheckpoint, compileDrift);
  computeDrift(tracesByTagFamily, compileDriftByTag);
  metrics.promptCompileDriftByCheckpoint = compileDrift;
  metrics.promptCompileDriftByTagFamily = compileDriftByTag;

  // ── 6) Automation trigger → run start latency ──────────────────────
  const triggerEvents = events.filter((e) => e.type === "automation_triggered");
  const runStartEvents = events.filter((e) => e.type === "automation_run_started");

  const latencies: number[] = [];
  for (const trigger of triggerEvents) {
    const runStart = runStartEvents.find(
      (rs) =>
        (rs.payload as any)?.triggerId === trigger.entityId ||
        (rs.payload as any)?.ruleId === (trigger.payload as any)?.ruleId,
    );
    if (runStart) {
      latencies.push(Date.parse(runStart.ts) - Date.parse(trigger.ts));
    }
  }
  metrics.automationTriggerToRunLatencyMs =
    latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)] : null;

  // ── 7) Idempotency dedupe hit rate ─────────────────────────────────
  const idempotencyIndexPath = path.join(projectDir, "events", "idempotency-index.json");
  try {
    const idxData = await readJson<{ entries?: Record<string, unknown>; totalProcessed?: number }>(
      idempotencyIndexPath,
    );
    const deduped = Object.keys(idxData.entries ?? {}).length;
    const total = idxData.totalProcessed ?? events.length;
    metrics.idempotencyDedupeHitRate = total > 0 ? deduped / total : 0;
  } catch {
    metrics.idempotencyDedupeHitRate = 0;
  }

  // ── 8) Escalation reason-code distribution ─────────────────────────
  const escalationReasons: Record<string, number> = {};
  for (const j of jobs) {
    if (j.escalatedAt && j.errorClass) {
      escalationReasons[j.errorClass] = (escalationReasons[j.errorClass] ?? 0) + 1;
    }
  }
  // Also check events
  for (const e of events) {
    if (e.type === "job_escalated" && (e.payload as any)?.reason) {
      const reason = String((e.payload as any).reason);
      escalationReasons[reason] = (escalationReasons[reason] ?? 0) + 1;
    }
  }
  metrics.escalationReasonCodeDistribution = escalationReasons;

  // ── 9) Pinned-profile drift violations ─────────────────────────────
  let pinnedViolations = 0;
  for (const e of events) {
    if (
      e.type === "profile_drift_violation" ||
      (e.type === "generation_completed" && (e.payload as any)?.pinnedProfileOverridden === true)
    ) {
      pinnedViolations++;
    }
  }
  metrics.pinnedProfileDriftViolations = pinnedViolations;

  // ── Persist snapshot ────────────────────────────────────────────────
  const id = ulid();
  const snapshot: MetricsSnapshot = {
    id,
    projectId: opts.projectId,
    createdAt: nowIso(),
    metrics,
  };

  opts.schemas.validateOrThrow("metrics-snapshot.schema.json", snapshot);
  const filePath = path.join(opts.projectsRoot, opts.projectId, "metrics-snapshots", `${id}.json`);
  await writeJsonAtomic(filePath, snapshot);
  return snapshot;
}
