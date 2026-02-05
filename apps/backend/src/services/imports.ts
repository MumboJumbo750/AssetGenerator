import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { createSpec } from "./specs";
import { getProject } from "./projects";

type ImportItem = {
  sourcePath: string;
  title?: string;
  assetType?: string;
  style?: string;
  scenario?: string;
  tags?: string[];
  status?: "draft" | "review" | "approved";
  provenance?: {
    source?: string;
    author?: string;
    license?: string;
    url?: string;
    notes?: string;
  };
};

type ImportResult = {
  assetId: string;
  specId: string;
  sourcePath: string;
  originalPath: string;
};

function nowIso() {
  return new Date().toISOString();
}

function toDataRel(dataRoot: string, absPath: string) {
  const rel = path.relative(dataRoot, absPath);
  return rel.split(path.sep).join("/");
}

async function readProject(projectsRoot: string, projectId: string) {
  const project = await getProject(projectsRoot, projectId);
  return project ?? null;
}

export async function importAssets(opts: {
  dataRoot: string;
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  items: ImportItem[];
}) {
  const project = await readProject(opts.projectsRoot, opts.projectId);
  if (!project) throw new Error("Project not found");

  const results: ImportResult[] = [];
  const errors: Array<{ sourcePath: string; error: string }> = [];

  for (const item of opts.items) {
    const sourcePath = item.sourcePath;
    if (!sourcePath) {
      errors.push({ sourcePath, error: "sourcePath is required" });
      continue;
    }
    if (!(await fileExists(sourcePath))) {
      errors.push({ sourcePath, error: "sourcePath not found" });
      continue;
    }

    const ext = path.extname(sourcePath) || ".png";
    const title = item.title ?? path.basename(sourcePath, ext);
    const assetType = item.assetType ?? "ui_icon";
    const style = item.style ?? project.defaults?.style ?? "cartoon";
    const scenario = item.scenario ?? project.defaults?.scenario ?? "fantasy";

    const spec = await createSpec({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      spec: {
        title,
        assetType,
        style,
        scenario,
        prompt: { positive: "", negative: "" },
        status: "ready",
      },
    });

    const assetId = ulid();
    const versionId = ulid();
    const variantId = ulid();
    const createdAt = nowIso();

    const originalAbs = path.join(
      opts.dataRoot,
      "projects",
      opts.projectId,
      "files",
      "images",
      assetId,
      "original",
      `${variantId}${ext}`,
    );
    await fs.mkdir(path.dirname(originalAbs), { recursive: true });
    await fs.copyFile(sourcePath, originalAbs);

    const asset = {
      id: assetId,
      projectId: opts.projectId,
      specId: spec.id,
      createdAt,
      updatedAt: createdAt,
      provenance: item.provenance,
      versions: [
        {
          id: versionId,
          createdAt,
          status: item.status ?? "review",
          generation: { source: "import", sourcePath: sourcePath },
          variants: [
            {
              id: variantId,
              originalPath: toDataRel(opts.dataRoot, originalAbs),
              tags: Array.isArray(item.tags) ? item.tags : undefined,
              status: "candidate",
            },
          ],
        },
      ],
    };

    opts.schemas.validateOrThrow("asset.schema.json", asset);
    await writeJsonAtomic(path.join(opts.projectsRoot, opts.projectId, "assets", `${assetId}.json`), asset);

    results.push({
      assetId,
      specId: spec.id,
      sourcePath,
      originalPath: toDataRel(opts.dataRoot, originalAbs),
    });
  }

  return { imported: results, errors };
}
