import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRootFromHere(importMetaUrl: string) {
  const here = path.dirname(fileURLToPath(importMetaUrl));
  return path.resolve(here, "../../../");
}

export function repoPath(repoRoot: string, ...segments: string[]) {
  return path.join(repoRoot, ...segments);
}

