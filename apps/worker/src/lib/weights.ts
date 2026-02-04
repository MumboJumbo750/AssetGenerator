import path from "node:path";

export type WeightsRef =
  | { kind: "absolute"; path: string; sha256?: string }
  | { kind: "repo_relative"; path: string; sha256?: string }
  | { kind: "config_relative"; base: "modelsRoot" | "checkpointsRoot" | "lorasRoot"; path: string; sha256?: string }
  | { kind: "external"; uri: string; sha256?: string };

export function resolveWeightsPath(opts: {
  repoRoot: string;
  local: { paths?: { modelsRoot?: string; checkpointsRoot?: string; lorasRoot?: string } } | null;
  weights?: WeightsRef;
  legacyLocalPath?: string;
}): string | null {
  if (opts.weights) {
    const w = opts.weights;
    if (w.kind === "absolute") return w.path;
    if (w.kind === "repo_relative") return path.resolve(opts.repoRoot, w.path);
    if (w.kind === "config_relative") {
      const root = opts.local?.paths?.[w.base];
      if (!root) return null;
      return path.resolve(root, w.path);
    }
    return null;
  }
  if (opts.legacyLocalPath) return opts.legacyLocalPath;
  return null;
}

