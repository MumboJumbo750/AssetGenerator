import { runCapture } from "./exec";

async function tryPython(command: string, args: string[]) {
  const result = await runCapture(command, [...args, "--version"]);
  if (result.code === 0) return { command, args };
  return null;
}

export async function findBasePython() {
  if (process.env.ASSETGEN_PYTHON) {
    const found = await tryPython(process.env.ASSETGEN_PYTHON, []);
    if (found) return found;
    throw new Error(`ASSETGEN_PYTHON is set but not runnable: ${process.env.ASSETGEN_PYTHON}`);
  }

  if (process.platform === "win32") {
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

  throw new Error("No usable Python found. Install Python 3.10+ (recommended 3.11) or set ASSETGEN_PYTHON.");
}

