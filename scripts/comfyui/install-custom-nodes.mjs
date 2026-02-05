import fs from "node:fs";
import path from "node:path";

import { run } from "../lib/exec.mjs";
import { repoPath } from "../lib/paths.mjs";

const comfyuiDir = repoPath("tools", "comfyui", "ComfyUI");
const customNodesDir = repoPath("tools", "comfyui", "ComfyUI", "custom_nodes");
const manifestPath = repoPath("pipeline", "comfyui", "manifest.json");
const manifestExamplePath = repoPath("pipeline", "comfyui", "manifest.example.json");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  if (!exists(comfyuiDir)) throw new Error("ComfyUI is not installed. Run: npm run comfyui:setup");
  fs.mkdirSync(customNodesDir, { recursive: true });

  const manifestFile = exists(manifestPath) ? manifestPath : manifestExamplePath;
  if (!exists(manifestFile)) throw new Error("No ComfyUI manifest found (pipeline/comfyui/manifest.json).");

  const manifest = readJson(manifestFile);
  const nodes = Array.isArray(manifest.customNodes) ? manifest.customNodes : [];
  if (nodes.length === 0) {
    console.log(`[comfyui:nodes] No customNodes in ${path.relative(repoPath(), manifestFile)}`);
    return;
  }

  console.log(`[comfyui:nodes] Using manifest: ${path.relative(repoPath(), manifestFile)}`);

  for (const node of nodes) {
    const name = String(node.name ?? "").trim();
    const repo = String(node.repo ?? "").trim();
    const ref = String(node.ref ?? "main").trim();
    if (!name || !repo) {
      console.warn("[comfyui:nodes] Skipping invalid entry:", node);
      continue;
    }

    const dest = path.join(customNodesDir, name);
    if (!exists(dest)) {
      console.log(`[comfyui:nodes] Cloning ${repo} -> ${dest}`);
      await run("git", ["clone", "--depth", "1", repo, dest], { cwd: repoPath() });
    } else {
      console.log(`[comfyui:nodes] Already present: ${dest}`);
    }

    // Best-effort checkout of requested ref.
    try {
      await run("git", ["-C", dest, "fetch", "--all", "--tags"], { cwd: repoPath() });
      await run("git", ["-C", dest, "checkout", ref], { cwd: repoPath() });
    } catch {
      console.log(`[comfyui:nodes] Note: unable to checkout ref=${ref} for ${name} (continuing).`);
    }

    // Optional: many nodes include requirements.txt.
    const req = path.join(dest, "requirements.txt");
    if (exists(req)) {
      console.log(`[comfyui:nodes] Found requirements.txt for ${name}. Install it inside the ComfyUI venv if needed.`);
      console.log(`  - ${req}`);
    }
  }

  console.log("[comfyui:nodes] Done.");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
