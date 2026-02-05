import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..", "..");

export function repoPath(...segments) {
  return path.join(repoRoot, ...segments);
}

export function platformPaths() {
  const isWindows = process.platform === "win32";
  return {
    isWindows,
    venvPython(venvDir) {
      return isWindows ? path.join(venvDir, "Scripts", "python.exe") : path.join(venvDir, "bin", "python");
    },
  };
}
