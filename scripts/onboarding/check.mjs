import fs from "node:fs/promises";
import path from "node:path";

import { repoPath } from "../lib/paths.mjs";
import { runCapture } from "../lib/exec.mjs";

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("[onboarding] Checking git...");
  const git = await runCapture("git", ["--version"]);
  if (git.code !== 0) {
    console.error("[onboarding] git is not available on PATH.");
    process.exit(1);
  }
  console.log(`[onboarding] ${git.stdout.trim() || "git OK"}`);

  console.log("[onboarding] Checking git lfs...");
  const lfs = await runCapture("git", ["lfs", "version"]);
  if (lfs.code !== 0) {
    console.warn("[onboarding] git-lfs not installed.");
    console.warn("  Install: https://git-lfs.com/");
  } else {
    console.log(`[onboarding] ${lfs.stdout.trim() || "git lfs OK"}`);
  }

  const gitattributes = repoPath(".gitattributes");
  if (!(await fileExists(gitattributes))) {
    console.warn("[onboarding] .gitattributes not found; LFS rules may be missing.");
  } else {
    const raw = await fs.readFile(gitattributes, "utf8");
    if (!raw.includes("filter=lfs")) {
      console.warn("[onboarding] .gitattributes exists but no LFS filters found.");
    } else {
      console.log("[onboarding] LFS filters detected in .gitattributes.");
    }
  }

  console.log("[onboarding] Done.");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
