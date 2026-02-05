import fs from "node:fs/promises";
import path from "node:path";

import { run, runCapture } from "../lib/exec";
import { findBasePython } from "../lib/python";
import type { JsonlLogger } from "../lib/logging";
import { tailString } from "../lib/logging";

function venvPython(venvDir: string) {
  return process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");
}

async function runLogged(
  log: JsonlLogger | undefined,
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
) {
  if (!log) {
    await run(command, args, options);
    return;
  }

  await log.info("exec_start", { command, args });
  const result = await runCapture(command, args, options);
  if (result.stdout) await log.debug("exec_stdout_tail", { stdout: tailString(result.stdout, 4000) });
  if (result.stderr) await log.warn("exec_stderr_tail", { stderr: tailString(result.stderr, 4000) });
  if (result.code !== 0) throw new Error(`Command failed (${result.code}): ${command} ${args.join(" ")}`);
  await log.info("exec_ok", { command });
}

export async function ensureBgVenv(repoRoot: string, log?: JsonlLogger) {
  const venvDir = path.join(repoRoot, "tools", "python", ".venv");
  const py = venvPython(venvDir);
  try {
    await fs.access(py);
    await log?.info("python_venv_ok", { python: py });
    return { venvDir, python: py };
  } catch {
    // create
  }

  const basePython = await findBasePython();
  await log?.info("python_venv_create", { basePython: { command: basePython.command, args: basePython.args } });

  await fs.mkdir(path.dirname(venvDir), { recursive: true });
  await runLogged(log, basePython.command, [...basePython.args, "-m", "venv", venvDir], { cwd: repoRoot });
  await runLogged(log, py, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: repoRoot });
  await runLogged(log, py, ["-m", "pip", "install", "rembg[cpu]", "pillow"], { cwd: repoRoot });
  return { venvDir, python: py };
}

export async function removeBackground(opts: {
  repoRoot: string;
  inputPath: string;
  outputPath: string;
  threshold?: number;
  feather?: number;
  erode?: number;
  log?: JsonlLogger;
}) {
  const { python } = await ensureBgVenv(opts.repoRoot, opts.log);
  const scriptPath = path.join(opts.repoRoot, "tools", "python", "bg_remove.py");
  const args = [scriptPath, "--in", opts.inputPath, "--out", opts.outputPath];
  if (typeof opts.threshold === "number") args.push("--threshold", String(opts.threshold));
  if (typeof opts.feather === "number" && opts.feather > 0) args.push("--feather", String(opts.feather));
  if (typeof opts.erode === "number" && opts.erode > 0) args.push("--erode", String(opts.erode));
  await runLogged(opts.log, python, args, { cwd: opts.repoRoot });
}
