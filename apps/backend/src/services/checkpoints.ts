import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type CheckpointRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  localPath?: string;
  weights?: Record<string, unknown>;
  supportedAssetTypes: string[];
  promptTemplates?: Record<string, unknown>;
  defaultGenerationParams?: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

async function listFromDir(dirPath: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items: CheckpointRecord[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<CheckpointRecord>(path.join(dirPath, e.name)));
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  } catch {
    return [];
  }
}

export async function listProjectCheckpoints(projectsRoot: string, projectId: string) {
  return listFromDir(path.join(projectsRoot, projectId, "checkpoints"));
}

export async function getProjectCheckpoint(projectsRoot: string, projectId: string, checkpointId: string) {
  const filePath = path.join(projectsRoot, projectId, "checkpoints", `${checkpointId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<CheckpointRecord>(filePath);
}

export async function createProjectCheckpoint(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  checkpoint: Partial<CheckpointRecord>;
}) {
  const id = opts.checkpoint.id?.trim() || ulid();
  const createdAt = nowIso();
  const checkpoint: CheckpointRecord = {
    id,
    name: opts.checkpoint.name?.trim() || `Checkpoint ${id}`,
    createdAt,
    updatedAt: createdAt,
    localPath: opts.checkpoint.localPath,
    weights: opts.checkpoint.weights,
    supportedAssetTypes: opts.checkpoint.supportedAssetTypes ?? ["ui_icon"],
    promptTemplates: opts.checkpoint.promptTemplates,
    defaultGenerationParams: opts.checkpoint.defaultGenerationParams,
  };

  opts.schemas.validateOrThrow("checkpoint.schema.json", checkpoint);
  const filePath = path.join(opts.projectsRoot, opts.projectId, "checkpoints", `${id}.json`);
  await writeJsonAtomic(filePath, checkpoint);
  return checkpoint;
}

export async function updateProjectCheckpoint(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  checkpointId: string;
  patch: Partial<CheckpointRecord>;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "checkpoints", `${opts.checkpointId}.json`);
  if (!(await fileExists(filePath))) return null;
  const checkpoint = await readJson<CheckpointRecord>(filePath);
  const next: CheckpointRecord = {
    ...checkpoint,
    updatedAt: nowIso(),
  };

  if (typeof opts.patch.name === "string") next.name = opts.patch.name.trim();
  if (opts.patch.localPath !== undefined) next.localPath = opts.patch.localPath;
  if (opts.patch.weights !== undefined) next.weights = opts.patch.weights;
  if (Array.isArray(opts.patch.supportedAssetTypes)) next.supportedAssetTypes = opts.patch.supportedAssetTypes;
  if (opts.patch.promptTemplates !== undefined) next.promptTemplates = opts.patch.promptTemplates;
  if (opts.patch.defaultGenerationParams !== undefined)
    next.defaultGenerationParams = opts.patch.defaultGenerationParams;

  opts.schemas.validateOrThrow("checkpoint.schema.json", next);
  await writeJsonAtomic(filePath, next);
  return next;
}
