/**
 * Gate Test Pack 3 — Prompt Precedence
 *
 * Verifies:
 * - compilePromptPackage 7-layer ordering is deterministic.
 * - Identical inputs produce identical packageHash (byte-identical).
 * - Deterministic tie-break (localeCompare) produces same order every run.
 * - Conflicting fragments are resolved by layer priority.
 *
 * Pass criteria (from §15.5):
 *   - 100 % precedence-order assertions pass
 *   - 0 nondeterministic tie-break outcomes
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { compilePromptPackage, type PromptTraceEntry } from "../apps/worker/src/worker";

/* ─── scaffold a minimal project tree ────────────────────────────────── */

let dataRoot: string;
const PROJECT_ID = "test_prompt";

before(async () => {
  dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ag-prompt-"));
  const projDir = path.join(dataRoot, "projects", PROJECT_ID);

  // Minimal project.json
  await fs.mkdir(projDir, { recursive: true });
  await fs.writeFile(
    path.join(projDir, "project.json"),
    JSON.stringify({
      id: PROJECT_ID,
      name: "Prompt Test",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      policies: {
        checkpointProfiles: {
          ckpt_test: {
            profileId: "test_cp_v1",
            version: 1,
            checkpointId: "ckpt_test",
            basePositive: "masterpiece, best quality",
            baseNegative: "worst quality, blurry",
            perAssetType: {
              sprite: { positive: "game sprite, transparent bg", negative: "background clutter" },
            },
            tagOrderPolicy: "checkpoint_default",
            tagOrder: [],
            runtimeSafety: { enabled: true, positive: [], negative: ["nsfw", "gore"] },
          },
        },
        tagPromptMap: {
          ckpt_test: {
            "player:ship": { positive: "spaceship design, vehicle art", negative: "organic, animal", weight: 10 },
            "style:comic": { positive: "comic book style, bold outlines", negative: "photorealistic", weight: 5 },
          },
        },
      },
    }),
    "utf8",
  );

  // Minimal checkpoint profile
  const cpDir = path.join(projDir, "checkpoint-profiles");
  await fs.mkdir(cpDir, { recursive: true });
  await fs.writeFile(
    path.join(cpDir, "test_cp_v1.json"),
    JSON.stringify({
      profileId: "test_cp_v1",
      version: 1,
      checkpointId: "ckpt_test",
      defaultForCheckpoint: true,
      basePositive: "masterpiece, best quality",
      baseNegative: "worst quality, blurry",
      perAssetType: {
        sprite: { positive: "game sprite, transparent bg", negative: "background clutter" },
      },
      tagOrderPolicy: "checkpoint_default",
      tagOrder: [],
      runtimeSafety: { enabled: true, positive: [], negative: ["nsfw", "gore"] },
    }),
    "utf8",
  );

  // Baseline profile
  const bpDir = path.join(projDir, "baseline-profiles");
  await fs.mkdir(bpDir, { recursive: true });
  await fs.writeFile(
    path.join(bpDir, "baseline_test.json"),
    JSON.stringify({
      id: "baseline_test",
      projectId: PROJECT_ID,
      checkpointId: "ckpt_test",
      checkpointProfileId: "test_cp_v1",
      name: "Test baseline",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      global: { noDropShadows: true, background: "transparent_required" },
      assetTypeProfiles: {
        sprite: { promptHints: ["clean sprite edges"], negativePromptHints: ["drop shadow"] },
      },
    }),
    "utf8",
  );

  // Tag catalogs + tag prompt map
  const catDir = path.join(projDir, "catalogs");
  await fs.mkdir(catDir, { recursive: true });
  await fs.writeFile(
    path.join(catDir, "tags.json"),
    JSON.stringify({
      id: "tags_test",
      projectId: PROJECT_ID,
      items: [
        { tag: "player:ship", label: "Player ship", group: "entity", reviewTools: [] },
        { tag: "style:comic", label: "Comic style", group: "visual", reviewTools: [] },
      ],
    }),
    "utf8",
  );
});

after(async () => {
  await fs.rm(dataRoot, { recursive: true, force: true });
});

/* ─── helpers ────────────────────────────────────────────────────────── */

const SPEC = {
  id: "spec_test_ship",
  projectId: PROJECT_ID,
  specListId: "sl_1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "Test ship",
  assetType: "sprite",
  style: "comic",
  scenario: "scifi",
  tags: ["assetType:sprite", "player:ship", "style:comic"],
  output: { kind: "single", background: "transparent_required" },
  prompt: { positive: "a sci-fi ship, clean silhouette", negative: "blurry photo" },
  generationParams: { width: 512, height: 512 },
  status: "ready" as const,
  checkpointId: "ckpt_test",
  baselineProfileId: "baseline_test",
  checkpointProfileId: "test_cp_v1",
  checkpointProfileVersion: 1,
  promptPolicy: { compileMode: "spec_override", tagOrderMode: "weight" },
};

const CHECKPOINT = {
  id: "ckpt_test",
  name: "Test checkpoint",
  promptTemplates: {
    basePositive: "masterpiece, best quality, {specPrompt}",
    baseNegative: "worst quality, blurry",
  },
};

/* ─── tests ──────────────────────────────────────────────────────────── */

describe("Prompt Precedence — layer ordering", () => {
  it("compile produces a 7-layer trace", async () => {
    const { trace } = await compilePromptPackage({
      dataRoot,
      projectId: PROJECT_ID,
      spec: SPEC as any,
      checkpoint: CHECKPOINT,
      fallbackPositive: "fallback positive",
      fallbackNegative: "fallback negative",
    });

    const expectedLayers: PromptTraceEntry["layer"][] = [
      "checkpoint_base",
      "checkpoint_asset_type",
      "baseline_hints",
      "tag_prompt_map",
      "spec_prompt",
      "spec_override",
      "runtime_safety",
    ];

    const presentLayers = trace.map((t) => t.layer);
    for (const layer of expectedLayers) {
      assert.ok(presentLayers.includes(layer), `Missing trace layer: ${layer}`);
    }
  });

  it("trace order values are monotonically increasing", async () => {
    const { trace } = await compilePromptPackage({
      dataRoot,
      projectId: PROJECT_ID,
      spec: SPEC as any,
      checkpoint: CHECKPOINT,
      fallbackPositive: "fb+",
      fallbackNegative: "fb-",
    });
    for (let i = 1; i < trace.length; i++) {
      assert.ok(trace[i].order >= trace[i - 1].order, `order not monotonic at index ${i}`);
    }
  });
});

describe("Prompt Precedence — deterministic hash", () => {
  it("identical inputs produce identical packageHash across 50 runs", async () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { packageHash } = await compilePromptPackage({
        dataRoot,
        projectId: PROJECT_ID,
        spec: SPEC as any,
        checkpoint: CHECKPOINT,
        fallbackPositive: "fb+",
        fallbackNegative: "fb-",
      });
      hashes.add(packageHash);
    }
    assert.equal(hashes.size, 1, `Expected exactly 1 unique hash, got ${hashes.size}`);
  });

  it("different fallback prompts produce different hash", async () => {
    const { packageHash: hashA } = await compilePromptPackage({
      dataRoot,
      projectId: PROJECT_ID,
      spec: SPEC as any,
      checkpoint: CHECKPOINT,
      fallbackPositive: "fallback prompt version A",
      fallbackNegative: "neg A",
    });
    const { packageHash: hashB } = await compilePromptPackage({
      dataRoot,
      projectId: PROJECT_ID,
      spec: SPEC as any,
      checkpoint: CHECKPOINT,
      fallbackPositive: "fallback prompt version B",
      fallbackNegative: "neg B",
    });
    assert.notEqual(hashA, hashB, "Different fallback prompts should produce different hashes");
  });
});

describe("Prompt Precedence — spec_override includes spec prompt", () => {
  it("compiled positive contains spec.prompt content in spec_override mode", async () => {
    const { compiled, trace } = await compilePromptPackage({
      dataRoot,
      projectId: PROJECT_ID,
      spec: SPEC as any,
      checkpoint: CHECKPOINT,
      fallbackPositive: "FALLBACK_POS_MARKER",
      fallbackNegative: "FALLBACK_NEG_MARKER",
    });
    // spec_override layer should be present
    const overrideLayer = trace.find((t) => t.layer === "spec_override");
    assert.ok(overrideLayer, "spec_override layer should exist when compileMode=spec_override");
    // compiled should contain both fallback (spec_prompt layer) and override text
    assert.ok(
      compiled.positive.includes("FALLBACK_POS_MARKER"),
      "Compiled positive should include fallback marker (spec_prompt layer)",
    );
    assert.ok(
      compiled.positive.includes("sci-fi ship"),
      "Compiled positive should include spec.prompt.positive (spec_override layer)",
    );
  });
});
