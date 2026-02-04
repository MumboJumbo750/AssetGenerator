import fs from "node:fs/promises";
import path from "node:path";

import { fileExists, readJson } from "../lib/json";

export type LoraEvalRecord = {
  id: string;
  loraId: string;
  releaseId: string;
  createdAt: string;
  status: "pending" | "running" | "complete";
  prompts: string[];
  outputs: Array<Record<string, unknown>>;
  notes?: string;
};

async function listFromDir(dirPath: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items: LoraEvalRecord[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<LoraEvalRecord>(path.join(dirPath, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function listProjectEvals(projectsRoot: string, projectId: string) {
  return listFromDir(path.join(projectsRoot, projectId, "evals"));
}

export async function listSharedEvals(dataRoot: string) {
  return listFromDir(path.join(dataRoot, "shared", "evals"));
}

export async function getProjectEval(projectsRoot: string, projectId: string, evalId: string) {
  const filePath = path.join(projectsRoot, projectId, "evals", `${evalId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<LoraEvalRecord>(filePath);
}

export async function getSharedEval(dataRoot: string, evalId: string) {
  const filePath = path.join(dataRoot, "shared", "evals", `${evalId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<LoraEvalRecord>(filePath);
}
