import fs from "node:fs/promises";
import path from "node:path";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

const catalogMap: Record<string, { fileName: string; schemaId: string }> = {
  "asset-types": { fileName: "asset-types.json", schemaId: "catalog.asset-types.schema.json" },
  styles: { fileName: "styles.json", schemaId: "catalog.styles.schema.json" },
  scenarios: { fileName: "scenarios.json", schemaId: "catalog.scenarios.schema.json" },
  palettes: { fileName: "palettes.json", schemaId: "catalog.palettes.schema.json" },
  tags: { fileName: "tags.json", schemaId: "catalog.tags.schema.json" },
};

export function getCatalogEntry(catalogId: string) {
  return catalogMap[catalogId] ?? null;
}

export type ResolvedCatalogScope = "project" | "checkpoint";

function projectCatalogPath(opts: { projectsRoot: string; projectId: string; fileName: string }) {
  return path.join(opts.projectsRoot, opts.projectId, "catalogs", opts.fileName);
}

function checkpointCatalogPath(opts: {
  projectsRoot: string;
  projectId: string;
  checkpointId: string;
  fileName: string;
}) {
  return path.join(opts.projectsRoot, opts.projectId, "catalogs", "checkpoints", opts.checkpointId, opts.fileName);
}

export async function getCatalog(opts: {
  projectsRoot: string;
  projectId: string;
  catalogId: string;
  checkpointId?: string;
  resolveFallback?: boolean;
}) {
  const entry = getCatalogEntry(opts.catalogId);
  if (!entry) return null;

  if (opts.checkpointId) {
    const scopedPath = checkpointCatalogPath({
      projectsRoot: opts.projectsRoot,
      projectId: opts.projectId,
      checkpointId: opts.checkpointId,
      fileName: entry.fileName,
    });
    if (await fileExists(scopedPath))
      return { catalog: await readJson(scopedPath), resolvedScope: "checkpoint" as const };
    if (!opts.resolveFallback) return null;
  }

  const fallbackPath = projectCatalogPath({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    fileName: entry.fileName,
  });
  if (!(await fileExists(fallbackPath))) return null;
  return { catalog: await readJson(fallbackPath), resolvedScope: "project" as const };
}

export async function putCatalog(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  catalogId: string;
  checkpointId?: string;
  body: unknown;
}) {
  const entry = getCatalogEntry(opts.catalogId);
  if (!entry) return null;

  opts.schemas.validateOrThrow(entry.schemaId, opts.body);

  const filePath = opts.checkpointId
    ? checkpointCatalogPath({
        projectsRoot: opts.projectsRoot,
        projectId: opts.projectId,
        checkpointId: opts.checkpointId,
        fileName: entry.fileName,
      })
    : projectCatalogPath({
        projectsRoot: opts.projectsRoot,
        projectId: opts.projectId,
        fileName: entry.fileName,
      });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await writeJsonAtomic(filePath, opts.body);
  return { ok: true };
}
