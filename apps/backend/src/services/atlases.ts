import fs from "node:fs/promises";
import path from "node:path";

import { fileExists, readJson } from "../lib/json";

export type AtlasRecord = {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  imagePath: string;
  packSettings: Record<string, unknown>;
  frames: Array<{
    id: string;
    sourcePath: string;
    rect: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
    pivot?: { x: number; y: number };
  }>;
};

export async function listAtlases(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "atlases");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: AtlasRecord[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<AtlasRecord>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  } catch {
    return [];
  }
}

export async function getAtlas(projectsRoot: string, projectId: string, atlasId: string) {
  const filePath = path.join(projectsRoot, projectId, "atlases", `${atlasId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<AtlasRecord>(filePath);
}
