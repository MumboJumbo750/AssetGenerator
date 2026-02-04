import fs from "node:fs/promises";
import path from "node:path";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type LoraRelease = {
  id: string;
  createdAt: string;
  status: "candidate" | "approved" | "deprecated";
  weights?: Record<string, unknown>;
  notes?: string;
  training?: Record<string, unknown>;
  evaluation?: Record<string, unknown>;
};

export type LoraRecord = {
  id: string;
  name: string;
  scope: "baseline" | "project";
  projectId?: string;
  checkpointId: string;
  assetTypes: string[];
  recommended?: boolean;
  activeReleaseId?: string;
  releases: LoraRelease[];
  createdAt: string;
  updatedAt: string;
};

export type LoraReleaseUpdate = {
  id: string;
  status?: "candidate" | "approved" | "deprecated";
  notes?: string | null;
};

export type LoraUpdatePatch = {
  recommended?: boolean;
  activeReleaseId?: string | null;
  releaseUpdates?: LoraReleaseUpdate[];
};

function nowIso() {
  return new Date().toISOString();
}

async function listFromDir(dirPath: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items: LoraRecord[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<LoraRecord>(path.join(dirPath, e.name)));
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  } catch {
    return [];
  }
}

async function updateLoraRecord(filePath: string, schemas: SchemaRegistry, patch: LoraUpdatePatch) {
  if (!(await fileExists(filePath))) return null;
  const lora = await readJson<LoraRecord>(filePath);

  const next: LoraRecord = {
    ...lora,
    releases: Array.isArray(lora.releases) ? [...lora.releases] : [],
    updatedAt: nowIso()
  };

  if (typeof patch.recommended === "boolean") {
    next.recommended = patch.recommended;
  }

  if (patch.activeReleaseId !== undefined) {
    if (patch.activeReleaseId === null || patch.activeReleaseId === "") {
      delete next.activeReleaseId;
    } else {
      const exists = next.releases.some((r) => r.id === patch.activeReleaseId);
      if (!exists) throw new Error(`Release ${patch.activeReleaseId} not found`);
      next.activeReleaseId = patch.activeReleaseId;
    }
  }

  if (Array.isArray(patch.releaseUpdates)) {
    for (const update of patch.releaseUpdates) {
      const release = next.releases.find((r) => r.id === update.id);
      if (!release) throw new Error(`Release ${update.id} not found`);
      if (update.status) release.status = update.status;
      if (update.notes !== undefined) {
        if (update.notes === null || update.notes === "") delete release.notes;
        else release.notes = update.notes;
      }
    }
  }

  schemas.validateOrThrow("lora.schema.json", next);
  await writeJsonAtomic(filePath, next);
  return next;
}

export async function listProjectLoras(projectsRoot: string, projectId: string) {
  return listFromDir(path.join(projectsRoot, projectId, "loras"));
}

export async function listSharedLoras(dataRoot: string) {
  return listFromDir(path.join(dataRoot, "shared", "loras"));
}

export async function getProjectLora(projectsRoot: string, projectId: string, loraId: string) {
  const filePath = path.join(projectsRoot, projectId, "loras", `${loraId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<LoraRecord>(filePath);
}

export async function getSharedLora(dataRoot: string, loraId: string) {
  const filePath = path.join(dataRoot, "shared", "loras", `${loraId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<LoraRecord>(filePath);
}

export async function updateProjectLora(
  projectsRoot: string,
  schemas: SchemaRegistry,
  projectId: string,
  loraId: string,
  patch: LoraUpdatePatch
) {
  const filePath = path.join(projectsRoot, projectId, "loras", `${loraId}.json`);
  return updateLoraRecord(filePath, schemas, patch);
}

export async function updateSharedLora(dataRoot: string, schemas: SchemaRegistry, loraId: string, patch: LoraUpdatePatch) {
  const filePath = path.join(dataRoot, "shared", "loras", `${loraId}.json`);
  return updateLoraRecord(filePath, schemas, patch);
}
