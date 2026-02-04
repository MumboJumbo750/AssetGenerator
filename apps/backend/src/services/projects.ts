import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  defaults: { style: string; scenario: string; paletteIds?: string[]; tagIds?: string[] };
  policies?: unknown;
  notes?: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function ensureProjectCatalogFiles(projectDir: string) {
  const catalogsDir = path.join(projectDir, "catalogs");
  await fs.mkdir(catalogsDir, { recursive: true });

  const defaults: Record<string, unknown> = {
    "asset-types.json": {
      id: "asset-types",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      assetTypes: [
        { id: "ui_icon", label: "UI Icon", requiresAlpha: true, multiFrame: false },
        { id: "logo", label: "Logo", requiresAlpha: true, multiFrame: false },
        { id: "sprite", label: "Sprite", requiresAlpha: true, multiFrame: false },
        { id: "spritesheet", label: "Spritesheet", requiresAlpha: true, multiFrame: true },
        { id: "texture", label: "Texture", tileable: true, multiFrame: false },
        { id: "tile", label: "Tile", tileable: true, multiFrame: false },
        { id: "overlay", label: "Overlay/VFX", requiresAlpha: true, multiFrame: false }
      ]
    },
    "styles.json": {
      id: "styles",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      styles: [
        { id: "cartoon", label: "Cartoon" },
        { id: "anime", label: "Anime" },
        { id: "realistic", label: "Realistic" },
        { id: "pixel_art", label: "Pixel Art" }
      ]
    },
    "scenarios.json": {
      id: "scenarios",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      scenarios: [{ id: "fantasy", label: "Fantasy" }, { id: "scifi", label: "Sci‑Fi" }, { id: "cyberpunk", label: "Cyberpunk" }]
    },
    "palettes.json": {
      id: "palettes",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      palettes: [{ id: "default", label: "Default", colors: ["#ffffff", "#000000"] }]
    },
    "tags.json": {
      id: "tags",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      groups: [
        {
          id: "assetType",
          label: "Asset Type",
          exclusive: true,
          tags: [
            { id: "assetType:ui_icon", label: "UI Icon" },
            { id: "assetType:logo", label: "Logo" },
            { id: "assetType:sprite", label: "Sprite" },
            { id: "assetType:spritesheet", label: "Spritesheet" },
            { id: "assetType:texture", label: "Texture" },
            { id: "assetType:tile", label: "Tile" },
            { id: "assetType:overlay", label: "Overlay" }
          ]
        },
        {
          id: "quality",
          label: "Quality",
          exclusive: false,
          tags: [{ id: "quality:high", label: "High" }, { id: "quality:medium", label: "Medium" }, { id: "quality:low", label: "Low" }]
        }
      ]
    }
  };

  for (const [name, contents] of Object.entries(defaults)) {
    const filePath = path.join(catalogsDir, name);
    if (await fileExists(filePath)) continue;
    await writeJsonAtomic(filePath, contents);
  }
}

export async function listProjects(projectsRoot: string) {
  try {
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    const projects: Project[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const projectJsonPath = path.join(projectsRoot, e.name, "project.json");
      if (!(await fileExists(projectJsonPath))) continue;
      projects.push(await readJson<Project>(projectJsonPath));
    }
    return projects;
  } catch {
    return [];
  }
}

export async function getProject(projectsRoot: string, projectId: string) {
  const filePath = path.join(projectsRoot, projectId, "project.json");
  if (!(await fileExists(filePath))) return null;
  return readJson<Project>(filePath);
}

export async function createProject(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  name: string;
  defaults?: { style?: string; scenario?: string };
}) {
  const id = ulid();
  const createdAt = nowIso();
  const project: Project = {
    id,
    name: opts.name,
    createdAt,
    updatedAt: createdAt,
    defaults: {
      style: opts.defaults?.style ?? "cartoon",
      scenario: opts.defaults?.scenario ?? "fantasy"
    },
    policies: {
      loraSelection: {
        mode: "baseline_then_project",
        preferRecommended: true,
        maxActiveLoras: 2,
        releasePolicy: "active_or_latest_approved"
      }
    }
  };

  opts.schemas.validateOrThrow("project.schema.json", project);

  const projectDir = path.join(opts.projectsRoot, id);
  await fs.mkdir(projectDir, { recursive: true });
  await ensureProjectCatalogFiles(projectDir);

  await writeJsonAtomic(path.join(projectDir, "project.json"), project);
  return project;
}

export async function updateProject(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  patch: { policies?: unknown; notes?: string | null };
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "project.json");
  if (!(await fileExists(filePath))) return null;
  const project = await readJson<Project>(filePath);
  const next: Project = {
    ...project,
    updatedAt: nowIso()
  };

  if (opts.patch.policies !== undefined) {
    next.policies = opts.patch.policies;
  }
  if (opts.patch.notes !== undefined) {
    if (opts.patch.notes === null || opts.patch.notes === "") delete next.notes;
    else next.notes = opts.patch.notes;
  }

  opts.schemas.validateOrThrow("project.schema.json", next);
  await writeJsonAtomic(filePath, next);
  return next;
}
