import fs from "node:fs/promises";
import path from "node:path";

import { repoPath } from "./lib/paths.mjs";
import { loadLocalConfig } from "./lib/config.mjs";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    force: false,
    dryRun: false,
    projectId: "astroduck_demo",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force") out.force = true;
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--project") out.projectId = args[++i] ?? out.projectId;
  }
  return out;
}

/**
 * Recursively copy a directory, skipping files that already exist unless force=true.
 */
async function copyDir(src, dest, { force = false, dryRun = false } = {}) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += await copyDir(srcPath, destPath, { force, dryRun });
    } else {
      if (!force && (await fileExists(destPath))) continue;
      if (!dryRun) {
        await fs.copyFile(srcPath, destPath);
      }
      count++;
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Seed logic                                                        */
/* ------------------------------------------------------------------ */

async function seedProject(opts, dataRoot) {
  const examplesRoot = repoPath("examples");
  const exampleProject = path.join(examplesRoot, opts.projectId);

  if (!(await fileExists(exampleProject))) {
    throw new Error(`No example found at ${exampleProject}. Available: ${(await fs.readdir(path.join(examplesRoot))).filter((d) => !d.startsWith(".") && d !== "README.md").join(", ")}`);
  }

  const projectRoot = path.join(dataRoot, "projects", opts.projectId);
  if (await fileExists(projectRoot)) {
    if (!opts.force) {
      throw new Error(`Project already exists: ${projectRoot} (use --force to overwrite)`);
    }
    if (!opts.dryRun) await fs.rm(projectRoot, { recursive: true, force: true });
  }

  if (opts.dryRun) {
    console.log(`[seed] Would copy ${exampleProject} → ${projectRoot}`);
    return;
  }

  // Copy project example data
  const copied = await copyDir(exampleProject, projectRoot, { force: true, dryRun: false });
  console.log(`[seed] Copied ${copied} files → ${projectRoot}`);

  // Copy shared data (e.g. baseline loras)
  const sharedSrc = path.join(examplesRoot, "shared");
  if (await fileExists(sharedSrc)) {
    const sharedDest = path.join(dataRoot, "shared");
    const sharedCount = await copyDir(sharedSrc, sharedDest, { force: opts.force, dryRun: false });
    console.log(`[seed] Copied ${sharedCount} shared files → ${sharedDest}`);
  }

  // Create empty runtime directories the app expects
  const runtimeDirs = [
    path.join(projectRoot, "assets"),
    path.join(projectRoot, "jobs"),
    path.join(projectRoot, "files"),
    path.join(dataRoot, "runtime"),
    path.join(dataRoot, "runtime", "worker-locks"),
  ];
  for (const dir of runtimeDirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  console.log(`[seed] Created runtime directories`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  const opts = parseArgs();
  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");

  console.log(`[seed] dataRoot=${dataRoot}`);
  await seedProject(opts, dataRoot);
  console.log("[seed] Done.");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
