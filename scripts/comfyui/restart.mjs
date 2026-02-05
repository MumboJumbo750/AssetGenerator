import { run } from "../lib/exec.mjs";
import { repoPath } from "../lib/paths.mjs";

async function main() {
  await run(process.execPath, [repoPath("scripts", "comfyui", "stop.mjs")], { cwd: repoPath() });
  await run(process.execPath, [repoPath("scripts", "comfyui", "start.mjs")], { cwd: repoPath() });
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
