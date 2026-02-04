# Workflow: LoRA training per checkpoint

## Goal
Train LoRAs on curated, tagged assets, **per checkpoint**, and make them selectable by asset type in the UI.

## Baseline-first recommendation
We recommend two LoRA layers:
- **Baseline LoRAs** (shared): improve general categories like UI icons, spritesheets, VFX, textures.
- **Project LoRAs**: project-specific characters/factions/style locks.

This keeps the “base quality” high while allowing projects to specialize.

## Inputs
- A target `checkpointId`
- A dataset selection rule:
  - include only `status: approved`
  - filter by tag queries (e.g., `assetType:character`, `style:anime`)
- Training config (resolution, steps, rank, learning rate, caption strategy)

## Dataset preparation
- Use alpha PNGs when available; fallback to original images.
- Ensure captions/tags are consistent:
  - tags become captions (or augment captions)
  - checkpoint-specific tokens can be injected
- Build datasets with filters:
  - `npm run dataset:build -- --project <projectId> --status approved --asset-type ui_icon --tag style:cyberpunk --checkpoint <checkpointId>`
  - Use `--tag-any` if you want to match any of the supplied tags (default is all tags).
- Caption strategies:
  - `--caption tags` (variant tags only)
  - `--caption tags+spec` (variant + spec tags)
  - `--caption tags+spec+title` (adds spec title for extra context)
  - Add `--with-tokens` to append prompt tokens from style/scenario/tag catalogs.
 - Provenance (optional):
   - `--provenance-source <text>` `--provenance-author <text>` `--provenance-license <text>` `--provenance-url <url>` `--provenance-notes <text>`
- Checkpoint-specific prompt token catalogs (optional):
  - `data/projects/<projectId>/catalogs/checkpoints/<checkpointId>/styles.json`
  - `data/projects/<projectId>/catalogs/checkpoints/<checkpointId>/scenarios.json`
  - `data/projects/<projectId>/catalogs/checkpoints/<checkpointId>/tags.json`

## Output
- LoRA weights stored outside Git (by default)
- LoRA metadata JSON stored in Git:
  - Baseline LoRAs: `data/shared/loras/<loraId>.json` (`scope: baseline`)
  - Project LoRAs: `data/projects/<projectId>/loras/<loraId>.json` (`scope: project`)
  - includes: target checkpoint, intended assetTypes, releases (variants), training data manifest hash

Record a training run:
- `npm run lora:train -- --lora <loraId> --dataset <datasetId|path> --project <projectId> --scope project`
- Add `--set-active` to make the new release the default.
- Include training config with `--config <json>` or `--resolution/--steps/--rank/--lr/--batch/--epochs`.

Kohya adapter (repo-local install):
- `npm run lora:setup`
- `npm run lora:train -- --adapter kohya_ss --run --config-file <kohya-config.json> --adapter-args "[\"--output_name\",\"my_lora\"]"`
- Provide an optional `--accelerate-config <accelerate.yaml>` when using `accelerate launch`.

Eval grid (scaffold):
- `npm run lora:eval -- --lora <loraId> --release <releaseId> --project <projectId> --prompts "ui icon, neon|sprite, top-down"`
- Eval records are stored under `data/projects/<projectId>/evals/<evalId>.json` (or `data/shared/evals/` for baseline).

Eval grid generation (jobs):
- `npm run lora:eval-grid -- --project <projectId> --lora <loraId> --release <releaseId> --prompts "ui icon, neon|sprite, top-down"`
- The worker will append output image paths to the eval record as jobs complete.
 - Optional cleanup: `npm run lora:cleanup-eval -- --project <projectId> --eval <evalId>` or pass `--auto-cleanup` on eval grid creation.
 - Normalize eval statuses if needed: `npm run lora:normalize-evals -- --scope project --project <projectId>` (use `--dry-run` to preview).

Dataset manifests (for reproducibility):
- Baseline datasets: `data/shared/datasets/<datasetId>.json` (schema: `schemas/dataset-manifest.schema.json`)
- Project datasets: `data/projects/<projectId>/datasets/<datasetId>.json` (schema: `schemas/dataset-manifest.schema.json`)

Weight files:
- Store the actual `.safetensors` outside Git and reference them from each LoRA `release.weights` (preferred) or `release.localPath` (deprecated).
- Configure `lorasRoot`/`checkpointsRoot` in `config/local.json` (see `docs/setup/local-config.md`).

## Evaluation gate
- Generate a fixed eval grid:
  - 3–5 canonical prompts per assetType
  - store images + settings
- Only publish LoRA to “recommended” after passing review.

## Beginner wizard (planned)
We should provide a guided UI so non-experts can train safely:
1) Select checkpoint
2) Select assetTypes + dataset filters (approved only + required tags)
3) Choose caption strategy (tags-only vs tags + promptTokens)
4) Pick a training preset (simple defaults)
5) Run training -> create a new `release` as `candidate`
6) Auto-generate eval grid -> approve -> set `activeReleaseId`

FAQ: `docs/faq.md`
