import { runCapture } from "./exec.mjs";

async function tryPython(command, args) {
  try {
    const result = await runCapture(command, [...args, "--version"]);
    if (result.code === 0) return { command, args };
    return null;
  } catch {
    return null;
  }
}

export async function findBasePython() {
  if (process.env.ASSETGEN_PYTHON) {
    const custom = await tryPython(process.env.ASSETGEN_PYTHON, []);
    if (custom) return custom;
    throw new Error(`ASSETGEN_PYTHON is set but not runnable: ${process.env.ASSETGEN_PYTHON}`);
  }

  const isWindows = process.platform === "win32";
  if (isWindows) {
    // Prefer the Python launcher to avoid PATH issues.
    for (const version of ["-3.11", "-3.10"]) {
      const found = await tryPython("py", [version]);
      if (found) return found;
    }
    const found = await tryPython("py", []);
    if (found) return found;
  }

  for (const cmd of ["python3", "python"]) {
    const found = await tryPython(cmd, []);
    if (found) return found;
  }

  throw new Error(
    "No usable Python found. Install Python 3.10+ (recommended 3.11) or set ASSETGEN_PYTHON to a python executable.",
  );
}
