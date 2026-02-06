import fs from "node:fs";

import { run } from "../lib/exec.mjs";
import { loadLocalConfig } from "../lib/config.mjs";
import { repoPath, platformPaths } from "../lib/paths.mjs";
import { findListeningPids, waitForPortFree } from "../lib/ports.mjs";

const comfyuiDir = repoPath("tools", "comfyui", "ComfyUI");
const venvDir = repoPath("tools", "comfyui", ".venv");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { venvPython } = platformPaths();
  const pythonInVenv = venvPython(venvDir);

  if (!exists(comfyuiDir)) {
    throw new Error("ComfyUI is not installed yet. Run: npm run comfyui:setup");
  }
  if (!exists(pythonInVenv)) {
    throw new Error("ComfyUI venv is missing. Run: npm run comfyui:setup");
  }

  const local = loadLocalConfig();
  const baseUrlRaw = local?.comfyui?.baseUrl ?? "http://127.0.0.1:8188";
  const baseUrl = /^[a-zA-Z]+:\/\//.test(baseUrlRaw) ? baseUrlRaw : `http://${baseUrlRaw}`;
  const url = new URL(baseUrl);
  const host = url.hostname || "127.0.0.1";
  const port = url.port ? Number(url.port) : 8188;
  const killInUse = process.argv.includes("--kill");
  const extraArgs = process.argv.slice(2).filter((arg) => arg !== "--kill");

  const pids = await findListeningPids(port);
  if (pids.size > 0) {
    if (!killInUse) {
      throw new Error(
        `Port ${port} is already in use by pid(s) ${[...pids].join(",")}. Run: npm run comfyui:stop (or start with --kill).`,
      );
    }

    console.log(`[comfyui:start] Port ${port} in use; stopping existing processes...`);
    // Use the same logic as comfyui:stop by shelling out so behavior stays consistent.
    await run(process.execPath, [repoPath("scripts", "comfyui", "stop.mjs")], { cwd: repoPath() });
    await waitForPortFree(port);
  }

  console.log(`[comfyui:start] Starting ComfyUI at ${host}:${port} (baseUrl=${baseUrlRaw})`);
  console.log(`[comfyui:start] Using venv python: ${pythonInVenv}`);
  console.log(`[comfyui:start] Working dir: ${comfyuiDir}`);

  await run(
    pythonInVevnCompat(pythonInVenv),
    ["main.py", "--listen", host, "--port", String(port), ...extraArgs],
    {
      cwd: comfyuiDir,
      env: process.env,
    },
  );
}

function pythonInVevnCompat(pythonPath) {
  // Work around accidental mixed casing in older scripts/tools.
  return pythonPath;
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
