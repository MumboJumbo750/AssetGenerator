import fs from "node:fs/promises";
import path from "node:path";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

const catalogMap: Record<string, { fileName: string; schemaId: string }> = {
  "asset-types": { fileName: "asset-types.json", schemaId: "catalog.asset-types.schema.json" },
  styles: { fileName: "styles.json", schemaId: "catalog.styles.schema.json" },
  scenarios: { fileName: "scenarios.json", schemaId: "catalog.scenarios.schema.json" },
  palettes: { fileName: "palettes.json", schemaId: "catalog.palettes.schema.json" },
  tags: { fileName: "tags.json", schemaId: "catalog.tags.schema.json" }
};

export function getCatalogEntry(catalogId: string) {
  return catalogMap[catalogId] ?? null;
}

export async function getCatalog(opts: { projectsRoot: string; projectId: string; catalogId: string }) {
  const entry = getCatalogEntry(opts.catalogId);
  if (!entry) return null;
  const filePath = path.join(opts.projectsRoot, opts.projectId, "catalogs", entry.fileName);
  if (!(await fileExists(filePath))) return null;
  return readJson(filePath);
}

export async function putCatalog(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  catalogId: string;
  body: unknown;
}) {
  const entry = getCatalogEntry(opts.catalogId);
  if (!entry) return null;

  opts.schemas.validateOrThrow(entry.schemaId, opts.body);

  const filePath = path.join(opts.projectsRoot, opts.projectId, "catalogs", entry.fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await writeJsonAtomic(filePath, opts.body);
  return { ok: true };
}
