import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { resolveLorasForGenerate } from "./loraResolver";
import { appendProjectEvent } from "./events";
import { upsertJobIndexEntry } from "./indexes";

export type Job = {
  id: string;
  projectId: string;
  type: "generate" | "bg_remove" | "atlas_pack" | "export";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  updatedAt: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  errorMessage?: string;
  errorClass?: "retryable" | "non_retryable" | "timeout" | "upstream_unavailable";
  attempt?: number;
  maxAttempts?: number;
  nextRetryAt?: string;
  retryHistory?: Array<{ attempt: number; error: string; errorClass: string; ts: string; durationMs?: number }>;
  escalatedAt?: string;
  escalationTarget?: "decision_sprint" | "exception_inbox" | "reject";
  logPath?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function listJobs(projectsRoot: string, projectId: string) {
  const indexPath = path.join(projectsRoot, projectId, "jobs-index.json");
  if (await fileExists(indexPath)) {
    try {
      const index = await readJson<{ items?: Array<{ id: string }> }>(indexPath);
      const ids = Array.isArray(index.items) ? index.items.map((item) => item.id).filter(Boolean) : [];
      const fromIndex: Job[] = [];
      for (const id of ids) {
        const filePath = path.join(projectsRoot, projectId, "jobs", `${id}.json`);
        if (!(await fileExists(filePath))) continue;
        fromIndex.push(await readJson<Job>(filePath));
      }
      if (fromIndex.length > 0) return fromIndex;
    } catch {
      // fall back to full scan
    }
  }

  const root = path.join(projectsRoot, projectId, "jobs");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: Job[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<Job>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function createJob(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  type: Job["type"];
  input: Record<string, unknown>;
}) {
  let input: Record<string, unknown> = opts.input ?? {};
  if (opts.type === "generate") {
    const dataRoot = path.join(opts.projectsRoot, "..");
    const resolved = await resolveLorasForGenerate({
      projectsRoot: opts.projectsRoot,
      dataRoot,
      projectId: opts.projectId,
      input,
    });
    if (resolved) {
      const existingSelection =
        input.loraSelection && typeof input.loraSelection === "object"
          ? (input.loraSelection as Record<string, unknown>)
          : {};
      input = {
        ...input,
        ...(resolved.loras.length > 0 ? { loras: resolved.loras } : {}),
        loraSelection: { ...existingSelection, ...resolved.loraSelection },
      };

      // Route to exception if resolver could not satisfy explicitly-requested LoRAs
      const unsatisfied = (resolved.loraSelection as any).unsatisfiedExplicit ?? 0;
      if (unsatisfied > 0) {
        const id = ulid();
        const createdAt = nowIso();
        const job: Job = {
          id,
          projectId: opts.projectId,
          type: opts.type,
          status: "failed",
          createdAt,
          updatedAt: createdAt,
          input,
          errorClass: "non_retryable",
          errorMessage: `Resolver could not satisfy ${unsatisfied} explicitly-requested LoRA(s). Check blocked items in resolverExplanation.`,
          escalatedAt: createdAt,
          escalationTarget: "exception_inbox",
        };
        opts.schemas.validateOrThrow("job.schema.json", job);
        const filePath = path.join(opts.projectsRoot, opts.projectId, "jobs", `${id}.json`);
        await writeJsonAtomic(filePath, job);
        await upsertJobIndexEntry({
          projectsRoot: opts.projectsRoot,
          projectId: opts.projectId,
          entry: { id: job.id, type: job.type, status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt },
        }).catch(() => undefined);
        return job;
      }
    }
  }

  const id = ulid();
  const createdAt = nowIso();
  const job: Job = {
    id,
    projectId: opts.projectId,
    type: opts.type,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    input,
  };

  opts.schemas.validateOrThrow("job.schema.json", job);

  const filePath = path.join(opts.projectsRoot, opts.projectId, "jobs", `${id}.json`);
  await writeJsonAtomic(filePath, job);
  await upsertJobIndexEntry({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    entry: { id: job.id, type: job.type, status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt },
  }).catch(() => undefined);
  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type: "job_queued",
      entityType: "job",
      entityId: job.id,
      idempotencyKey: `job:${job.id}:queued`,
      payload: { jobType: job.type, status: job.status },
    },
  }).catch(() => undefined);
  return job;
}

export async function getJob(projectsRoot: string, projectId: string, jobId: string) {
  const filePath = path.join(projectsRoot, projectId, "jobs", `${jobId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<Job>(filePath);
}

export async function cancelJob(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  jobId: string;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "jobs", `${opts.jobId}.json`);
  if (!(await fileExists(filePath))) return null;
  const job = await readJson<Job>(filePath);

  if (job.status === "succeeded" || job.status === "failed") return job;
  if (job.status === "canceled") return job;

  job.status = "canceled";
  job.updatedAt = nowIso();
  opts.schemas.validateOrThrow("job.schema.json", job);
  await writeJsonAtomic(filePath, job);
  await upsertJobIndexEntry({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    entry: { id: job.id, type: job.type, status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt },
  }).catch(() => undefined);
  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type: "job_canceled",
      entityType: "job",
      entityId: job.id,
      idempotencyKey: `job:${job.id}:canceled`,
      payload: { status: job.status },
    },
  }).catch(() => undefined);
  return job;
}

export async function retryJob(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  jobId: string;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "jobs", `${opts.jobId}.json`);
  if (!(await fileExists(filePath))) return null;
  const job = await readJson<Job>(filePath);

  if (job.status !== "failed" && job.status !== "canceled") return job;

  job.status = "queued";
  job.updatedAt = nowIso();
  delete job.error;
  delete job.output;
  // Clear Phase 7 retry/escalation fields so the job starts fresh
  delete (job as any).errorClass;
  delete (job as any).escalatedAt;
  delete (job as any).escalationTarget;
  delete (job as any).nextRetryAt;
  (job as any).attempt = 1;
  (job as any).maxAttempts = undefined;
  delete (job as any).maxAttempts;
  // Preserve retryHistory for auditability — do not clear it
  opts.schemas.validateOrThrow("job.schema.json", job);
  await writeJsonAtomic(filePath, job);
  await upsertJobIndexEntry({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    entry: { id: job.id, type: job.type, status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt },
  }).catch(() => undefined);
  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type: "job_retried",
      entityType: "job",
      entityId: job.id,
      idempotencyKey: `job:${job.id}:retried:${job.updatedAt}`,
      payload: { status: job.status },
    },
  }).catch(() => undefined);
  return job;
}
