# Workflow: asset creation

For recreated specs and new autopilot-ready specs, also follow:

- `docs/workflows/spec-recreation-happy-loop.md`

## 0) Create/select a project

Project defines defaults:

- default style/scenario
- global tag groups (click chips)
- palettes/colors
- available checkpoints + LoRAs

Data: `data/projects/<projectId>/project.json` + catalogs.

## 1) Intake: SpecList (human text)

User provides a “wishlist” (SpecList) like:

- asset types needed (character, prop, UI icon, tile, VFX frame…)
- constraints (camera angle, silhouette, size, palette)
- references (optional links/files)

Output: a structured **refinement** into AssetSpecs.

Persist the raw intake:

- `data/projects/<projectId>/spec-lists/<specListId>.json`

Asset types come from the project catalog:

- `data/projects/<projectId>/catalogs/asset-types.json`

## 2) Refinement: SpecList -> AssetSpecs

Refinement produces one JSON per asset spec:

- `assetType` (drives which LoRA + UI fields are used)
- `checkpointId` (or auto-selection rules)
- `style` + `scenario` (project defaults, override per spec)
- `prompt.positive` and `prompt.negative` (examples stored per spec)
- `tags` (project-wide + spec-specific)
- `generationParams` (size, steps, sampler, CFG, seed rules)
- `baselineProfileId`, `loraPolicy`, `styleConsistency`, `qualityContract` (required for happy-loop automation)

Data: `data/projects/<projectId>/specs/<specId>.json`

## 3) Generate (variants)

User selects:

- checkpoint + LoRA combo (can be suggested automatically from assetType)
- number of variants

Suggestion rules:

- default LoRA selection follows `project.policies.loraSelection` (baseline vs project scope ordering)

Generation job creates:

- original images
- preview thumbnails
- metadata (seed, prompt, model hashes if available)

Data:

- Job: `data/projects/<projectId>/jobs/<jobId>.json`
- Files: `data/projects/<projectId>/files/images/<assetId>/original/*`

### Job chaining (orchestration)

Jobs can enqueue follow‑up jobs by adding `nextJobs` to the generate input:

```
{
  "type": "generate",
  "input": {
    "specId": "<specId>",
    "checkpointName": "ckpt_sd15_demo",
    "nextJobs": [
      { "type": "bg_remove", "input": { "originalPath": "$output.originalsDir/..." } }
    ]
  }
}
```

Template placeholders supported:

- `$output.<key>` (from previous job output)
- `$input.<key>` (from previous job input)
- `$projectId`, `$jobId`

### Concurrency + locking

Worker controls per‑project throughput with:

- `ASSETGEN_WORKER_PROJECT_CONCURRENCY` (default `1`)
- `ASSETGEN_WORKER_PROJECT_LOCK_TTL_MS` (default `30000`)

## 4) Review & tagging

Gallery supports:

- side-by-side compare
- quick tag chips (predefined groups)
- “approve” (for production) vs “reject” vs “needs regeneration”
- mark best variant as “primary”
- add short review notes to capture decisions

Output:

- approved variants are eligible for background removal and spritesheet packing

## 5) Post-process: alpha removal

Run background removal on approved variants.
Parameters (threshold/feather/erode) are stored under `variant.processing.bg_remove`.
Output:

- alpha PNGs
- optional trim + padding metadata

See `docs/pipeline/background-removal.md`.

## 6) Spritesheet stitching (optional)

For multi-frame assets (animations, VFX, UI states):

- select a set of alpha PNG frames
- define frame order, pivot/origin, padding
- pack into atlas image + JSON metadata
- record animation metadata (fps/loop/frame order) in the AssetSpec output

See `docs/pipeline/spritesheets.md`.

## 7) Export

Export bundles are engine/profile specific:

- Unity, Godot, Unreal, custom

Export produces:

- image files
- atlas metadata
- manifest JSON (links back to asset/spec IDs)
