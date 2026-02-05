import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { repoPath } from "../lib/paths.mjs";

function normalize(p) {
  return p.replaceAll("\\", "/");
}

function schemaForDataPath(absolutePath) {
  const rel = normalize(path.relative(repoPath(), absolutePath));

  // Runtime artifacts (logs/heartbeats/etc.) are not part of the versioned "DB".
  // They are produced by running the app and may vary per machine.
  if (rel.match(/^data\/runtime\//)) return null;
  if (rel.match(/^data\/migrations\//)) return null;

  // Artifact files: validate only what we have schemas for.
  if (rel.includes("/files/")) {
    if (rel.match(/^data\/projects\/[^/]+\/files\/exports\/[^/]+\/pixi-kit\/manifest\.json$/)) {
      return "pixi-kit-manifest.schema.json";
    }
    return null;
  }

  // Shared data
  if (rel.match(/^data\/shared\/loras\/[^/]+\.json$/)) return "lora.schema.json";
  if (rel.match(/^data\/shared\/datasets\/[^/]+\.json$/)) return "dataset-manifest.schema.json";
  if (rel.match(/^data\/shared\/evals\/[^/]+\.json$/)) return "eval.schema.json";

  // Project data
  if (rel.match(/^data\/projects\/[^/]+\/project\.json$/)) return "project.schema.json";

  if (rel.match(/^data\/projects\/[^/]+\/catalogs\/asset-types\.json$/)) return "catalog.asset-types.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/catalogs\/styles\.json$/)) return "catalog.styles.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/catalogs\/scenarios\.json$/)) return "catalog.scenarios.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/catalogs\/palettes\.json$/)) return "catalog.palettes.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/catalogs\/tags\.json$/)) return "catalog.tags.schema.json";

  if (rel.match(/^data\/projects\/[^/]+\/checkpoints\/[^/]+\.json$/)) return "checkpoint.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/loras\/[^/]+\.json$/)) return "lora.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/evals\/[^/]+\.json$/)) return "eval.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/spec-lists\/[^/]+\.json$/)) return "spec-list.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/specs\/[^/]+\.json$/)) return "asset-spec.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/assets\/[^/]+\.json$/)) return "asset.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/atlases\/[^/]+\.json$/)) return "atlas.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/datasets\/[^/]+\.json$/)) return "dataset-manifest.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/export-profiles\/[^/]+\.json$/)) return "export-profile.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/exports\/[^/]+\.json$/)) return "export.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/jobs\/[^/]+\.json$/)) return "job.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/automation-rules\/[^/]+\.json$/)) return "automation-rule.schema.json";
  if (rel.match(/^data\/projects\/[^/]+\/automation-runs\/[^/]+\.json$/)) return "automation-run.schema.json";

  return "__UNKNOWN__";
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function loadSchemas(ajv) {
  const schemaFiles = await fg(["*.schema.json"], { cwd: repoPath("schemas"), absolute: true });
  for (const file of schemaFiles) {
    const schema = await readJson(file);
    ajv.addSchema(schema);
  }
  return schemaFiles.length;
}

function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) return "";
  return errors
    .map((e) => {
      const instancePath = e.instancePath || "/";
      const msg = e.message ?? "invalid";
      return `- ${instancePath} ${msg}`;
    })
    .join("\n");
}

async function validateConfig(ajv) {
  const candidates = [repoPath("config", "local.example.json"), repoPath("config", "local.json")];
  let ok = true;

  for (const file of candidates) {
    try {
      await fs.access(file);
    } catch {
      continue;
    }
    const data = await readJson(file);
    const validate = ajv.getSchema("local-config.schema.json");
    if (!validate) throw new Error("local-config.schema.json not loaded.");

    const valid = validate(data);
    if (!valid) {
      ok = false;
      console.error(`\n[config] Invalid: ${normalize(path.relative(repoPath(), file))}`);
      console.error(formatAjvErrors(validate.errors));
    } else {
      console.log(`[config] OK: ${normalize(path.relative(repoPath(), file))}`);
    }
  }

  return ok;
}

async function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const schemaCount = await loadSchemas(ajv);
  console.log(`[schemas] Loaded ${schemaCount} schema(s).`);

  let ok = true;

  const dataRoot = repoPath("data");
  try {
    await fs.access(dataRoot);
  } catch {
    console.log("[data] No data/ folder found; skipping data validation.");
    const configOk = await validateConfig(ajv);
    process.exit(configOk ? 0 : 1);
  }

  const jsonFiles = await fg(["**/*.json"], { cwd: dataRoot, absolute: true });
  if (jsonFiles.length === 0) {
    console.log("[data] No JSON files found under data/; nothing to validate.");
    const configOk = await validateConfig(ajv);
    process.exit(configOk ? 0 : 1);
  }

  for (const file of jsonFiles) {
    const schemaId = schemaForDataPath(file);
    if (schemaId === null) continue;

    const rel = normalize(path.relative(repoPath(), file));
    if (schemaId === "__UNKNOWN__") {
      ok = false;
      console.error(`\n[data] Unknown JSON path (no schema mapping): ${rel}`);
      continue;
    }

    const validate = ajv.getSchema(schemaId);
    if (!validate) throw new Error(`Schema not loaded: ${schemaId}`);

    let data;
    try {
      data = await readJson(file);
    } catch (err) {
      ok = false;
      console.error(`\n[data] Invalid JSON: ${rel}`);
      console.error(err?.message ?? err);
      continue;
    }

    const valid = validate(data);
    if (!valid) {
      ok = false;
      console.error(`\n[data] Invalid: ${rel}`);
      console.error(`schema: ${schemaId}`);
      console.error(formatAjvErrors(validate.errors));
    }
  }

  const configOk = await validateConfig(ajv);
  if (!configOk) ok = false;

  if (!ok) process.exit(1);
  console.log("\nOK");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
