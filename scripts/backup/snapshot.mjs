import fs from "node:fs/promises";
import path from "node:path";

import { repoPath } from "../lib/paths.mjs";
import { loadLocalConfig } from "../lib/config.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    dataRoot: "",
    outDir: "",
    includeRuntime: false,
    dryRun: false
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--data-root") out.dataRoot = args[++i] ?? "";
    if (a === "--out") out.outDir = args[++i] ?? "";
    if (a === "--include-runtime") out.includeRuntime = true;
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function copyDir(src, dest, opts) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const rel = path.relative(opts.base, srcPath);
    if (!opts.includeRuntime && rel.startsWith(`runtime${path.sep}`)) continue;
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, opts);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  const args = parseArgs();
  const local = loadLocalConfig();
  const dataRoot = path.resolve(args.dataRoot || local?.dataRoot || repoPath("data"));
  const outDir = path.resolve(args.outDir || repoPath("backups"));
  const stamp = nowStamp();
  const dest = path.join(outDir, `data_${stamp}`);

  if (args.dryRun) {
    console.log(`[backup] Would snapshot ${dataRoot} -> ${dest}`);
    return;
  }

  await copyDir(dataRoot, dest, { base: dataRoot, includeRuntime: args.includeRuntime });
  console.log(`[backup] Snapshot complete: ${dest}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
