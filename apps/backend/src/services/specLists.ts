import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type SpecList = {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  text: string;
  status: "draft" | "refined" | "archived";
  derivedSpecIds?: string[];
  notes?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function listSpecLists(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "spec-lists");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: SpecList[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<SpecList>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function createSpecList(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  title: string;
  text: string;
}) {
  const id = ulid();
  const createdAt = nowIso();
  const specList: SpecList = {
    id,
    projectId: opts.projectId,
    createdAt,
    updatedAt: createdAt,
    title: opts.title,
    text: opts.text,
    status: "draft"
  };

  opts.schemas.validateOrThrow("spec-list.schema.json", specList);

  const filePath = path.join(opts.projectsRoot, opts.projectId, "spec-lists", `${id}.json`);
  await writeJsonAtomic(filePath, specList);
  return specList;
}

export async function updateSpecList(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  specListId: string;
  patch: Partial<SpecList>;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "spec-lists", `${opts.specListId}.json`);
  if (!(await fileExists(filePath))) return null;

  const current = await readJson<SpecList>(filePath);
  const updated: SpecList = {
    ...current,
    status: (opts.patch?.status ?? current.status) as SpecList["status"],
    derivedSpecIds: Array.isArray(opts.patch?.derivedSpecIds) ? opts.patch?.derivedSpecIds : current.derivedSpecIds,
    notes: typeof opts.patch?.notes === "string" ? opts.patch.notes : current.notes,
    updatedAt: nowIso()
  };

  opts.schemas.validateOrThrow("spec-list.schema.json", updated);
  await writeJsonAtomic(filePath, updated);
  return updated;
}
