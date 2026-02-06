/**
 * Gate Test Pack 2 — Checkpoint Switch
 *
 * Verifies:
 * - copax and pony baseline profiles resolve correctly for their checkpoint.
 * - Cross-checkpoint mismatch throws (baseline bound to wrong checkpoint).
 * - Profile pinning is respected (100 % of reruns resolve same profile).
 * - Project checkpointBaselineMap policy enforcement.
 *
 * Pass criteria (from §15.5):
 *   - 0 incompatible baseline/profile resolutions
 *   - profile pinning respected in 100 % of reruns
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { enforceCheckpointCompatibility } from "../apps/backend/src/services/specs";

const PROJECT_ID = "astroduck_demo";

let projectsRoot: string;

/* ─── seed a minimal project tree from examples/ ─────────────────────── */

before(async () => {
  projectsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ag-ckpt-"));
  const examplesDir = path.resolve("examples", "astroduck_demo");
  const destDir = path.join(projectsRoot, PROJECT_ID);

  // Copy project.json
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(path.join(examplesDir, "project.json"), path.join(destDir, "project.json"));

  // Copy baseline-profiles/
  const bpSrc = path.join(examplesDir, "baseline-profiles");
  const bpDst = path.join(destDir, "baseline-profiles");
  await fs.mkdir(bpDst, { recursive: true });
  for (const f of await fs.readdir(bpSrc)) {
    await fs.copyFile(path.join(bpSrc, f), path.join(bpDst, f));
  }

  // Copy legacy baseline-profile.json
  await fs.copyFile(
    path.join(examplesDir, "baseline-profile.json"),
    path.join(destDir, "baseline-profile.json"),
  );
});

after(async () => {
  await fs.rm(projectsRoot, { recursive: true, force: true });
});

/* ─── tests ──────────────────────────────────────────────────────────── */

describe("Checkpoint Switch — compatible resolutions", () => {
  it("copax checkpoint + copax baseline resolves without error", async () => {
    await enforceCheckpointCompatibility({
      projectsRoot,
      projectId: PROJECT_ID,
      checkpointId: "ckpt_copax_sdxl",
      baselineProfileId: "baseline_copax",
    });
    // If we get here, no throw → pass
  });

  it("pony checkpoint + pony baseline resolves without error", async () => {
    await enforceCheckpointCompatibility({
      projectsRoot,
      projectId: PROJECT_ID,
      checkpointId: "ckpt_pony_v6xl",
      baselineProfileId: "baseline_pony",
    });
  });

  it("sd15 checkpoint + default baseline resolves (legacy path)", async () => {
    await enforceCheckpointCompatibility({
      projectsRoot,
      projectId: PROJECT_ID,
      checkpointId: "ckpt_sd15_demo",
      baselineProfileId: "baseline_astroduck_demo_default",
    });
  });
});

describe("Checkpoint Switch — mismatch detection", () => {
  it("copax checkpoint + pony baseline throws mismatch error", async () => {
    await assert.rejects(
      () =>
        enforceCheckpointCompatibility({
          projectsRoot,
          projectId: PROJECT_ID,
          checkpointId: "ckpt_copax_sdxl",
          baselineProfileId: "baseline_pony",
        }),
      (err: Error) => {
        assert.match(err.message, /bound to checkpoint/);
        return true;
      },
    );
  });

  it("pony checkpoint + copax baseline throws mismatch error", async () => {
    await assert.rejects(
      () =>
        enforceCheckpointCompatibility({
          projectsRoot,
          projectId: PROJECT_ID,
          checkpointId: "ckpt_pony_v6xl",
          baselineProfileId: "baseline_copax",
        }),
      (err: Error) => {
        assert.match(err.message, /bound to checkpoint/);
        return true;
      },
    );
  });

  it("non-existent baseline throws not-found error", async () => {
    await assert.rejects(
      () =>
        enforceCheckpointCompatibility({
          projectsRoot,
          projectId: PROJECT_ID,
          checkpointId: "ckpt_copax_sdxl",
          baselineProfileId: "nonexistent_baseline",
        }),
      (err: Error) => {
        assert.match(err.message, /not found/);
        return true;
      },
    );
  });
});

describe("Checkpoint Switch — profile pinning stability", () => {
  it("100 repeated resolutions produce identical results (0 variance)", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 100; i++) {
      try {
        await enforceCheckpointCompatibility({
          projectsRoot,
          projectId: PROJECT_ID,
          checkpointId: "ckpt_copax_sdxl",
          baselineProfileId: "baseline_copax",
        });
        results.push(true); // compatible
      } catch {
        results.push(false); // incompatible
      }
    }
    const passRate = results.filter(Boolean).length / results.length;
    assert.equal(passRate, 1, "Profile pinning must be 100 % stable");
  });
});

describe("Checkpoint Switch — skip when optional fields missing", () => {
  it("no checkpointId → no-op (no error)", async () => {
    await enforceCheckpointCompatibility({
      projectsRoot,
      projectId: PROJECT_ID,
      baselineProfileId: "baseline_copax",
    });
  });

  it("no baselineProfileId → no-op (no error)", async () => {
    await enforceCheckpointCompatibility({
      projectsRoot,
      projectId: PROJECT_ID,
      checkpointId: "ckpt_copax_sdxl",
    });
  });
});
