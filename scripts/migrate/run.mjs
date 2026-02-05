import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import fg from "fast-glob";

import { repoPath } from "../lib/paths.mjs";
import { loadLocalConfig } from "../lib/config.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    id: "",
    all: false,
    list: false,
    dryRun: false,
    dataRoot: "",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--id") out.id = args[++i] ?? "";
    if (a === "--all") out.all = true;
    if (a === "--list") out.list = true;
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--data-root") out.dataRoot = args[++i] ?? "";
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function loadMigrations(stepsDir) {
  const files = await fg(["*.mjs"], { cwd: stepsDir, absolute: true });
  const migrations = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    if (!mod?.id || typeof mod.run !== "function") continue;
    migrations.push({
      id: String(mod.id),
      description: String(mod.description ?? ""),
      run: mod.run,
      file,
    });
  }
  migrations.sort((a, b) => a.id.localeCompare(b.id));
  return migrations;
}

async function loadApplied(appliedPath) {
  try {
    return await readJson(appliedPath);
  } catch {
    return { applied: [] };
  }
}

async function main() {
  const opts = parseArgs();
  const local = loadLocalConfig();
  const dataRoot = path.resolve(opts.dataRoot || local?.dataRoot || repoPath("data"));
  const stepsDir = repoPath("scripts", "migrate", "steps");
  const appliedPath = path.join(dataRoot, "migrations", "applied.json");

  const migrations = await loadMigrations(stepsDir);
  if (opts.list) {
    console.log("[migrate] Available migrations:");
    for (const m of migrations) console.log(`- ${m.id} ${m.description}`.trim());
    return;
  }

  if (!opts.all && !opts.id) {
    console.log("Usage: npm run migrate:run -- --all | --id <migrationId> [--dry-run]");
    console.log("  Optional: --list --data-root <path>");
    process.exit(1);
  }

  const applied = await loadApplied(appliedPath);
  const appliedSet = new Set((applied.applied ?? []).map((item) => item.id));

  const targets = opts.all ? migrations : migrations.filter((m) => m.id === opts.id);
  if (targets.length === 0) {
    console.log("[migrate] No matching migrations.");
    return;
  }

  for (const migration of targets) {
    if (appliedSet.has(migration.id) && !opts.dryRun) {
      console.log(`[migrate] Skip ${migration.id} (already applied).`);
      continue;
    }
    console.log(`[migrate] Running ${migration.id}${opts.dryRun ? " (dry-run)" : ""}`);
    await migration.run({
      dataRoot,
      dryRun: opts.dryRun,
      readJson,
      writeJson,
      log: console,
    });
    if (!opts.dryRun) {
      applied.applied = applied.applied ?? [];
      applied.applied.push({ id: migration.id, description: migration.description, appliedAt: nowIso() });
      await writeJson(appliedPath, applied);
    }
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
