import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type AssetSpec = {
  id: string;
  projectId: string;
  specListId?: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  assetType: string;
  checkpointId?: string;
  loraIds?: string[];
  output?: {
    kind?: "single_image" | "animation" | "ui_states" | "logo_set";
    background?: "transparent_required" | "any";
    animation?: { name?: string; fps?: number; loop?: boolean; frameCount?: number; frameNames?: string[] };
  };
  style: string;
  scenario: string;
  prompt: { positive: string; negative: string };
  generationParams?: Record<string, unknown>;
  status?: "draft" | "ready" | "deprecated";
};

function nowIso() {
  return new Date().toISOString();
}

export async function listSpecs(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "specs");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: AssetSpec[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<AssetSpec>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function getSpec(projectsRoot: string, projectId: string, specId: string) {
  const filePath = path.join(projectsRoot, projectId, "specs", `${specId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<AssetSpec>(filePath);
}

export async function createSpec(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  spec: Partial<AssetSpec>;
}) {
  const id = ulid();
  const createdAt = nowIso();
  const spec: AssetSpec = {
    id,
    projectId: opts.projectId,
    specListId: opts.spec?.specListId,
    createdAt,
    updatedAt: createdAt,
    title: opts.spec?.title ?? `Spec ${id}`,
    assetType: opts.spec?.assetType ?? "ui_icon",
    checkpointId: opts.spec?.checkpointId,
    loraIds: Array.isArray(opts.spec?.loraIds) ? opts.spec?.loraIds : undefined,
    style: opts.spec?.style ?? "cartoon",
    scenario: opts.spec?.scenario ?? "fantasy",
    prompt: {
      positive: opts.spec?.prompt?.positive ?? "",
      negative: opts.spec?.prompt?.negative ?? "",
    },
    generationParams: opts.spec?.generationParams ?? {},
    status: (opts.spec?.status ?? "draft") as AssetSpec["status"],
  };

  opts.schemas.validateOrThrow("spec.schema.json", spec);

  const filePath = path.join(opts.projectsRoot, opts.projectId, "specs", `${id}.json`);
  await writeJsonAtomic(filePath, spec);
  return spec;
}

export async function updateSpec(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  specId: string;
  patch: Partial<AssetSpec>;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "specs", `${opts.specId}.json`);
  if (!(await fileExists(filePath))) return null;
  const spec = await readJson<AssetSpec>(filePath);

  if (typeof opts.patch?.title === "string") spec.title = opts.patch.title;
  if (typeof opts.patch?.assetType === "string") spec.assetType = opts.patch.assetType;
  if (typeof opts.patch?.checkpointId === "string") spec.checkpointId = opts.patch.checkpointId;
  if (Array.isArray(opts.patch?.loraIds)) spec.loraIds = opts.patch.loraIds;
  if (typeof opts.patch?.style === "string") spec.style = opts.patch.style;
  if (typeof opts.patch?.scenario === "string") spec.scenario = opts.patch.scenario;
  if (opts.patch?.prompt) spec.prompt = { ...spec.prompt, ...opts.patch.prompt };
  if (opts.patch?.generationParams) spec.generationParams = opts.patch.generationParams;
  if (typeof opts.patch?.status === "string") spec.status = opts.patch.status as any;
  if (opts.patch?.output) spec.output = opts.patch.output as any;

  spec.updatedAt = nowIso();
  opts.schemas.validateOrThrow("spec.schema.json", spec);
  await writeJsonAtomic(filePath, spec);
  return spec;
}
