import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

import { repoPath } from "./lib/paths.mjs";
import { loadLocalConfig } from "./lib/config.mjs";

const SEED_TIME = "2026-02-03T00:00:00.000Z";

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function writeJson(p, v) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2) + "\n", "utf8");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    force: false,
    dryRun: false,
    projectId: "astroduck_demo",
    projectName: "AstroDuck Space Shooter (Demo)",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force") out.force = true;
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--project") out.projectId = args[++i] ?? out.projectId;
    if (a === "--name") out.projectName = args[++i] ?? out.projectName;
  }
  return out;
}

function makeProject(opts) {
  return {
    id: opts.projectId,
    name: opts.projectName,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    defaults: {
      style: "comic",
      scenario: "scifi",
      paletteIds: ["astroduck_neon"],
    },
    policies: {
      loraSelection: {
        mode: "baseline_then_project",
        preferRecommended: true,
        maxActiveLoras: 2,
        releasePolicy: "active_or_latest_approved",
      },
    },
    notes: "Seeded demo project for exercising the AssetGenerator pipeline.",
  };
}

function makeCatalogs() {
  return {
    assetTypes: {
      id: "asset-types",
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      assetTypes: [
        { id: "ui_icon", label: "UI Icon", requiresAlpha: true, multiFrame: false, defaultTags: ["assetType:ui_icon"] },
        { id: "logo", label: "Logo", requiresAlpha: true, multiFrame: false, defaultTags: ["assetType:logo"] },
        { id: "sprite", label: "Sprite", requiresAlpha: true, multiFrame: false, defaultTags: ["assetType:sprite"] },
        {
          id: "spritesheet",
          label: "Spritesheet",
          requiresAlpha: true,
          multiFrame: true,
          defaultTags: ["assetType:spritesheet"],
        },
        { id: "texture", label: "Texture", tileable: true, multiFrame: false, defaultTags: ["assetType:texture"] },
        { id: "tile", label: "Tile", tileable: true, multiFrame: false, defaultTags: ["assetType:tile"] },
        {
          id: "overlay",
          label: "Overlay/VFX",
          requiresAlpha: true,
          multiFrame: false,
          defaultTags: ["assetType:overlay"],
        },
      ],
    },
    styles: {
      id: "styles",
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      styles: [
        { id: "comic", label: "Comic", promptTokens: ["comic style", "bold outlines", "high contrast"] },
        { id: "cartoon", label: "Cartoon", promptTokens: ["cartoon", "clean shapes"] },
        { id: "pixel_art", label: "Pixel Art", promptTokens: ["pixel art", "low-res"] },
        { id: "realistic", label: "Realistic", promptTokens: ["realistic"] },
      ],
    },
    scenarios: {
      id: "scenarios",
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      scenarios: [
        { id: "scifi", label: "Sci-Fi", promptTokens: ["sci-fi", "space", "neon lights"] },
        { id: "fantasy", label: "Fantasy", promptTokens: ["fantasy"] },
        { id: "cyberpunk", label: "Cyberpunk", promptTokens: ["cyberpunk", "neon city"] },
      ],
    },
    palettes: {
      id: "palettes",
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      palettes: [
        {
          id: "astroduck_neon",
          label: "AstroDuck Neon",
          description: "High contrast comic palette with neon accents.",
          colors: ["#0B1020", "#EEF2FF", "#6D7CFF", "#00E5FF", "#FF3D71", "#FFB300", "#22C55E"],
          promptTokens: ["neon accents", "high contrast"],
        },
      ],
    },
    tags: {
      id: "tags",
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      groups: [
        {
          id: "assetType",
          label: "Asset Type",
          exclusive: true,
          tags: [
            { id: "assetType:ui_icon", label: "UI Icon" },
            { id: "assetType:logo", label: "Logo" },
            { id: "assetType:sprite", label: "Sprite" },
            { id: "assetType:spritesheet", label: "Spritesheet" },
            { id: "assetType:texture", label: "Texture" },
            { id: "assetType:tile", label: "Tile" },
            { id: "assetType:overlay", label: "Overlay/VFX" },
          ],
        },
        {
          id: "level",
          label: "Level",
          exclusive: true,
          tags: [
            { id: "level:earth", label: "Earth" },
            { id: "level:mars", label: "Mars" },
            { id: "level:sun", label: "Sun" },
          ],
        },
        {
          id: "ui",
          label: "UI",
          exclusive: false,
          tags: [
            { id: "ui:menu", label: "Menu" },
            { id: "ui:hud", label: "HUD" },
            { id: "ui:level_select", label: "Level Select" },
            { id: "ui:difficulty", label: "Difficulty" },
          ],
        },
        {
          id: "vfx",
          label: "VFX",
          exclusive: false,
          tags: [
            { id: "vfx:projectile", label: "Projectile" },
            { id: "vfx:muzzle_flash", label: "Muzzle Flash" },
            { id: "vfx:impact", label: "Impact" },
            { id: "vfx:explosion", label: "Explosion" },
            { id: "vfx:warp", label: "Warp" },
            { id: "vfx:thruster", label: "Thruster" },
            { id: "vfx:shield", label: "Shield" },
          ],
        },
      ],
    },
  };
}

function makeCheckpoint(opts) {
  return {
    id: "ckpt_sd15_demo",
    name: "Stable Diffusion 1.5 (Demo)",
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    weights: { kind: "config_relative", base: "checkpointsRoot", path: "sd15.safetensors" },
    supportedAssetTypes: ["logo", "sprite", "spritesheet", "texture", "ui_icon", "overlay", "tile"],
    promptTemplates: {
      basePositive: "sci-fi comic style, bold outlines, high contrast, clean silhouette, {specPrompt}",
      baseNegative: "photo, watermark, text, low contrast, blurry, cluttered background",
    },
    defaultGenerationParams: { width: 512, height: 512, steps: 20, cfg: 7, sampler: "euler", scheduler: "normal" },
  };
}

function makeBaselineLora() {
  return {
    id: "lora_baseline_2d_game_assets",
    name: "Baseline 2D Game Assets (Demo)",
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    scope: "baseline",
    checkpointId: "ckpt_sd15_demo",
    assetTypes: ["ui_icon", "sprite", "spritesheet", "logo", "texture"],
    recommended: true,
    activeReleaseId: "rel_v1",
    releases: [
      {
        id: "rel_v1",
        createdAt: SEED_TIME,
        status: "approved",
        weights: {
          kind: "config_relative",
          base: "lorasRoot",
          path: "baseline_2d_game_assets.safetensors",
          sha256: "0000000000000000",
        },
        notes: "Example baseline LoRA entry; replace with your real trained LoRA.",
      },
    ],
  };
}

function makeProjectLora() {
  return {
    id: "lora_astroduck_characters",
    name: "AstroDuck Characters (Demo)",
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    scope: "project",
    checkpointId: "ckpt_sd15_demo",
    assetTypes: ["sprite", "spritesheet"],
    recommended: true,
    activeReleaseId: "rel_v1",
    releases: [
      {
        id: "rel_v1",
        createdAt: SEED_TIME,
        status: "candidate",
        weights: {
          kind: "config_relative",
          base: "lorasRoot",
          path: "astroduck_characters_v1.safetensors",
          sha256: "0000000000000000",
        },
        notes: "Example project LoRA entry; mark approved after eval.",
      },
    ],
  };
}

async function seedAstroDuckDemo(opts, dataRoot) {
  const projectRoot = path.join(dataRoot, "projects", opts.projectId);
  if (await fileExists(projectRoot)) {
    if (!opts.force) {
      throw new Error(`Project already exists: ${projectRoot} (use --force to overwrite)`);
    }
    if (!opts.dryRun) await fs.rm(projectRoot, { recursive: true, force: true });
  }

  const sharedLorasDir = path.join(dataRoot, "shared", "loras");
  const projectDir = projectRoot;
  const catalogsDir = path.join(projectDir, "catalogs");
  const checkpointsDir = path.join(projectDir, "checkpoints");
  const projectLorasDir = path.join(projectDir, "loras");
  const specListsDir = path.join(projectDir, "spec-lists");
  const specsDir = path.join(projectDir, "specs");
  const assetsDir = path.join(projectDir, "assets");
  const jobsDir = path.join(projectDir, "jobs");
  const filesDir = path.join(projectDir, "files");

  const project = makeProject(opts);
  const catalogs = makeCatalogs();
  const checkpoint = makeCheckpoint(opts);
  const baselineLora = makeBaselineLora();
  const projectLora = makeProjectLora();

  const specListSrc = repoPath("docs", "demo", "astroduck", "spec-list.json");
  const specList = await readJson(specListSrc);
  specList.projectId = opts.projectId;
  specList.updatedAt = SEED_TIME;
  specList.createdAt = SEED_TIME;

  const specSrcDir = repoPath("docs", "demo", "astroduck", "specs");
  const specSrcFiles = await fg(["*.json"], { cwd: specSrcDir, absolute: true });
  const specs = [];
  for (const file of specSrcFiles) {
    const spec = await readJson(file);
    spec.projectId = opts.projectId;
    spec.createdAt = SEED_TIME;
    spec.updatedAt = SEED_TIME;
    // Ensure the demo checkpoint is suggested (optional field).
    spec.checkpointId = spec.checkpointId ?? "ckpt_sd15_demo";
    specs.push(spec);
  }

  if (opts.dryRun) {
    console.log(`[seed] Would create project at ${projectRoot}`);
    console.log(`[seed] Specs: ${specs.length}`);
    return;
  }

  await fs.mkdir(sharedLorasDir, { recursive: true });
  await fs.mkdir(catalogsDir, { recursive: true });
  await fs.mkdir(checkpointsDir, { recursive: true });
  await fs.mkdir(projectLorasDir, { recursive: true });
  await fs.mkdir(specListsDir, { recursive: true });
  await fs.mkdir(specsDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(jobsDir, { recursive: true });
  await fs.mkdir(filesDir, { recursive: true });
  const automationRulesDir = path.join(projectDir, "automation-rules");
  await fs.mkdir(automationRulesDir, { recursive: true });

  await writeJson(path.join(projectDir, "project.json"), project);
  await writeJson(path.join(catalogsDir, "asset-types.json"), catalogs.assetTypes);
  await writeJson(path.join(catalogsDir, "styles.json"), catalogs.styles);
  await writeJson(path.join(catalogsDir, "scenarios.json"), catalogs.scenarios);
  await writeJson(path.join(catalogsDir, "palettes.json"), catalogs.palettes);
  await writeJson(path.join(catalogsDir, "tags.json"), catalogs.tags);

  await writeJson(path.join(checkpointsDir, `${checkpoint.id}.json`), checkpoint);

  await writeJson(path.join(sharedLorasDir, `${baselineLora.id}.json`), baselineLora);
  await writeJson(path.join(projectLorasDir, `${projectLora.id}.json`), projectLora);

  await writeJson(path.join(specListsDir, `${specList.id}.json`), specList);

  for (const spec of specs) {
    if (!spec?.id) continue;
    await writeJson(path.join(specsDir, `${spec.id}.json`), spec);
  }

  // Automation rule: auto atlas-pack when all animation frames are approved.
  const autoAtlasPackRule = {
    id: "rule_auto_atlas_pack",
    projectId: opts.projectId,
    name: "Auto atlas-pack on animation approval",
    description:
      "When an asset is approved, check if it belongs to an animation spec " +
      "and all frames are now approved. If so, enqueue an atlas_pack job automatically.",
    enabled: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    trigger: { type: "asset_approved" },
    actions: [
      {
        type: "auto_atlas_pack",
        config: { padding: 2, maxSize: 2048, trim: true },
      },
    ],
  };
  await writeJson(path.join(automationRulesDir, `${autoAtlasPackRule.id}.json`), autoAtlasPackRule);

  console.log(`[seed] Created ${projectRoot}`);
  console.log(`[seed] Wrote specs=${specs.length} specListId=${specList.id}`);
}

async function main() {
  const opts = parseArgs();
  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");

  console.log(`[seed] dataRoot=${dataRoot}`);
  await seedAstroDuckDemo(opts, dataRoot);
  console.log("[seed] Done.");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
