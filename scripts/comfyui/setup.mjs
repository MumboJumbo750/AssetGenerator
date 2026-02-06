import fs from "node:fs";
import path from "node:path";

import { run } from "../lib/exec.mjs";
import { loadLocalConfig } from "../lib/config.mjs";
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

function resolveTorchInstallConfig() {
  const local = loadLocalConfig();
  const torchIndexUrl =
    process.env.ASSETGEN_TORCH_INDEX_URL ??
    local?.comfyui?.torchIndexUrl ??
    (process.platform === "win32" ? "https://download.pytorch.org/whl/cu128" : null);
  const torchPackages =
    process.env.ASSETGEN_TORCH_PACKAGES ?? local?.comfyui?.torchPackages ?? "torch torchvision torchaudio";

  return {
    torchIndexUrl,
    torchPackages: String(torchPackages)
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean),
  };
}

async function installTorchPackages(pythonInVenv) {
  const { torchIndexUrl, torchPackages } = resolveTorchInstallConfig();
  if (!torchIndexUrl) {
    console.log("[comfyui:setup] Skipping explicit torch wheel install (no torchIndexUrl configured).");
    return;
  }
  if (torchPackages.length === 0) {
    console.log("[comfyui:setup] Skipping explicit torch wheel install (no torchPackages configured).");
    return;
  }

  console.log(`[comfyui:setup] Installing torch packages from ${torchIndexUrl}: ${torchPackages.join(" ")}`);
  await run(
    pythonInVenv,
    ["-m", "pip", "install", "--upgrade", "--no-cache-dir", ...torchPackages, "--index-url", torchIndexUrl],
    {
      cwd: repoPath(),
    },
  );
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

  await installTorchPackages(pythonInVenv);

  console.log("[comfyui:setup] Done.");
  console.log("Next: npm run comfyui:start");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
