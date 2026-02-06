import path from "node:path";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";

type JobIndexEntry = {
  id: string;
  type: "generate" | "bg_remove" | "atlas_pack" | "export";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  updatedAt: string;
};

type AutomationRunIndexEntry = {
  id: string;
  ruleId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function jobsIndexPath(projectsRoot: string, projectId: string) {
  return path.join(projectsRoot, projectId, "jobs-index.json");
}

function automationRunsIndexPath(projectsRoot: string, projectId: string) {
  return path.join(projectsRoot, projectId, "automation-runs-index.json");
}

export async function upsertJobIndexEntry(opts: { projectsRoot: string; projectId: string; entry: JobIndexEntry }) {
  const filePath = jobsIndexPath(opts.projectsRoot, opts.projectId);
  const current = (await fileExists(filePath))
    ? await readJson<{ projectId: string; updatedAt: string; items: JobIndexEntry[] }>(filePath)
    : { projectId: opts.projectId, updatedAt: nowIso(), items: [] };
  const items = Array.isArray(current.items) ? [...current.items] : [];
  const idx = items.findIndex((item) => item.id === opts.entry.id);
  if (idx >= 0) items[idx] = opts.entry;
  else items.push(opts.entry);
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeJsonAtomic(filePath, { projectId: opts.projectId, updatedAt: nowIso(), items });
}

export async function upsertAutomationRunIndexEntry(opts: {
  projectsRoot: string;
  projectId: string;
  entry: AutomationRunIndexEntry;
}) {
  const filePath = automationRunsIndexPath(opts.projectsRoot, opts.projectId);
  const current = (await fileExists(filePath))
    ? await readJson<{ projectId: string; updatedAt: string; items: AutomationRunIndexEntry[] }>(filePath)
    : { projectId: opts.projectId, updatedAt: nowIso(), items: [] };
  const items = Array.isArray(current.items) ? [...current.items] : [];
  const idx = items.findIndex((item) => item.id === opts.entry.id);
  if (idx >= 0) items[idx] = opts.entry;
  else items.push(opts.entry);
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeJsonAtomic(filePath, { projectId: opts.projectId, updatedAt: nowIso(), items });
}
