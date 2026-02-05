import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { resolveLorasForGenerate } from "./loraResolver";

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
  logPath?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function listJobs(projectsRoot: string, projectId: string) {
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
  opts.schemas.validateOrThrow("job.schema.json", job);
  await writeJsonAtomic(filePath, job);
  return job;
}
