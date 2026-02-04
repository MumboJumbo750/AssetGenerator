import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type ExportProfile = {
  id: string;
  projectId: string;
  name: string;
  type: "pixi_kit";
  createdAt: string;
  updatedAt: string;
  options: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

export async function listExportProfiles(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "export-profiles");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: ExportProfile[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<ExportProfile>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  } catch {
    return [];
  }
}

export async function getExportProfile(projectsRoot: string, projectId: string, profileId: string) {
  const filePath = path.join(projectsRoot, projectId, "export-profiles", `${profileId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<ExportProfile>(filePath);
}

export async function createExportProfile(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  body: Partial<ExportProfile>;
}) {
  const id = ulid();
  const createdAt = nowIso();
  const profile: ExportProfile = {
    id,
    projectId: opts.projectId,
    name: opts.body?.name ?? `Profile ${id}`,
    type: (opts.body?.type ?? "pixi_kit") as ExportProfile["type"],
    createdAt,
    updatedAt: createdAt,
    options: opts.body?.options ?? {}
  };

  opts.schemas.validateOrThrow("export-profile.schema.json", profile);

  const dir = path.join(opts.projectsRoot, opts.projectId, "export-profiles");
  await fs.mkdir(dir, { recursive: true });
  await writeJsonAtomic(path.join(dir, `${id}.json`), profile);
  return profile;
}

export async function updateExportProfile(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  profileId: string;
  patch: Partial<ExportProfile>;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "export-profiles", `${opts.profileId}.json`);
  if (!(await fileExists(filePath))) return null;
  const profile = await readJson<ExportProfile>(filePath);

  if (typeof opts.patch?.name === "string") profile.name = opts.patch.name;
  if (typeof opts.patch?.type === "string") profile.type = opts.patch.type as ExportProfile["type"];
  if (opts.patch?.options) profile.options = opts.patch.options as Record<string, unknown>;
  profile.updatedAt = nowIso();

  opts.schemas.validateOrThrow("export-profile.schema.json", profile);
  await writeJsonAtomic(filePath, profile);
  return profile;
}
