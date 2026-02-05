import fs from "node:fs";
import path from "node:path";

import { run } from "../lib/exec.mjs";
import { repoPath, platformPaths } from "../lib/paths.mjs";
import { findBasePython } from "../lib/python.mjs";

const comfyuiRepoUrl = "https://github.com/comfyanonymous/ComfyUI.git";
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
  console.log("[comfyui:setup] Setting up ComfyUI inside the repo...");

  if (!exists(comfyuiDir)) {
    fs.mkdirSync(path.dirname(comfyuiDir), { recursive: true });
    console.log(`[comfyui:setup] Cloning ${comfyuiRepoUrl} -> ${comfyuiDir}`);
    await run("git", ["clone", "--depth", "1", comfyuiRepoUrl, comfyuiDir], { cwd: repoPath() });
  } else {
    console.log(`[comfyui:setup] ComfyUI already exists at ${comfyuiDir}`);
  }

  const { venvPython } = platformPaths();
  const pythonInVenv = venvPython(venvDir);

  if (!exists(pythonInVenv)) {
    const basePython = await findBasePython();
    fs.mkdirSync(path.dirname(venvDir), { recursive: true });
    console.log(`[comfyui:setup] Creating repo-local venv at ${venvDir}`);
    await run(basePython.command, [...basePython.args, "-m", "venv", venvDir], { cwd: repoPath() });
  } else {
    console.log(`[comfyui:setup] Venv already exists at ${venvDir}`);
  }

  console.log("[comfyui:setup] Installing/upgrading pip...");
  await run(pythonInVenv, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: repoPath() });

  console.log("[comfyui:setup] Installing ComfyUI requirements (this can take a while)...");
  await run(pythonInVenv, ["-m", "pip", "install", "-r", path.join(comfyuiDir, "requirements.txt")], {
    cwd: repoPath(),
  });

  console.log("[comfyui:setup] Done.");
  console.log("Next: npm run comfyui:start");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
