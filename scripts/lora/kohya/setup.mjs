import fs from "node:fs";
import path from "node:path";

import { run } from "../../lib/exec.mjs";
import { repoPath, platformPaths } from "../../lib/paths.mjs";
import { findBasePython } from "../../lib/python.mjs";

const kohyaRepoUrl = "https://github.com/bmaltais/kohya_ss.git";
const kohyaDir = repoPath("tools", "lora", "kohya_ss");
const venvDir = repoPath("tools", "lora", "kohya_ss", ".venv");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("[lora:setup] Setting up kohya_ss inside the repo...");

  if (!exists(kohyaDir)) {
    fs.mkdirSync(path.dirname(kohyaDir), { recursive: true });
    console.log(`[lora:setup] Cloning ${kohyaRepoUrl} -> ${kohyaDir}`);
    await run("git", ["clone", "--depth", "1", kohyaRepoUrl, kohyaDir], { cwd: repoPath() });
  } else {
    console.log(`[lora:setup] kohya_ss already exists at ${kohyaDir}`);
  }

  console.log("[lora:setup] Syncing submodules...");
  await run("git", ["-C", kohyaDir, "submodule", "update", "--init", "--recursive"], { cwd: repoPath() });

  const { venvPython } = platformPaths();
  const pythonInVenv = venvPython(venvDir);

  if (!exists(pythonInVenv)) {
    const basePython = await findBasePython();
    fs.mkdirSync(path.dirname(venvDir), { recursive: true });
    console.log(`[lora:setup] Creating repo-local venv at ${venvDir}`);
    await run(basePython.command, [...basePython.args, "-m", "venv", venvDir], { cwd: repoPath() });
  } else {
    console.log(`[lora:setup] Venv already exists at ${venvDir}`);
  }

  console.log("[lora:setup] Installing/upgrading pip...");
  await run(pythonInVenv, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: repoPath() });

  const requirementsPath = path.join(kohyaDir, "requirements.txt");
  if (exists(requirementsPath)) {
    console.log("[lora:setup] Installing kohya_ss requirements (this can take a while)...");
    await run(pythonInVenv, ["-m", "pip", "install", "-r", requirementsPath], { cwd: kohyaDir });
  } else {
    console.log("[lora:setup] requirements.txt not found; skipping pip install.");
  }

  console.log("[lora:setup] Done.");
  console.log("Next: npm run lora:train -- --adapter kohya_ss --run ...");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
