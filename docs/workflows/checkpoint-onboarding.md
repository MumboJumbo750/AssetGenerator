# Workflow: checkpoint onboarding (make it usable in UI)

## Goal

Adding a checkpoint should require **no code changes** to appear in the UI:
only new JSON metadata + (optionally) local model weights.

## Steps

1. Add checkpoint metadata JSON:
   - `data/projects/<projectId>/checkpoints/<checkpointId>.json`
   - (Seed data lives in `examples/` and is copied to `data/` via `npm run seed`)
2. Define:
   - supported `assetTypes` (must match the project asset type catalog)
   - prompt templates (global, and/or per assetType)
   - checkpoint profile defaults (tag order, negative guardrails, prompt compile mode)
   - default generation params (size/steps/sampler)
   - optional checkpoint-specific tags/tokens
   - weights reference (`weights` preferred, `localPath` deprecated) and configure `config/local.json` if using `config_relative`
   - `vaeWeights` (optional) — explicit VAE override for checkpoints that need a specific VAE (e.g., Pony). Uses the same `weights` / `localPath` / `config_relative` pattern as model weights.
   - `defaultGenerationParams.clip_skip` — set per checkpoint (e.g., `2` for Pony SDXL)
3. (Optional) Add recommended LoRAs for this checkpoint:
   - Baseline: `data/shared/loras/<loraId>.json` (seed source: `examples/shared/loras/`)
   - Project-specific: `data/projects/<projectId>/loras/<loraId>.json` (seed source: `examples/<projectId>/loras/`)
4. Verify in UI:
   - checkpoint appears in selectors
   - example positive/negative prompt renders for a spec
   - compatible baseline profiles are available for this checkpoint
   - prompt compile trace shows checkpoint profile and ordered tag fragments
   - compile trace layers visible: `checkpoint_base` → `checkpoint_asset_type` → `baseline_hints` → `tag_prompt_map` → `spec_prompt` → `spec_override` → `runtime_safety`
   - `schemas/compile-trace.schema.json` validates the persisted trace

## Checkpoint templates

Prefer templates with placeholders, e.g.:

- `{styleTokens}`
- `{scenarioTokens}`
- `{assetTypeTokens}`
- `{specPrompt}`
- `{tagTokens}`
- `{negTokens}`

The backend should render templates deterministically and store the resolved prompt used for each generated image.

## Checkpoint profile bundle (required for deterministic switching)

Each checkpoint should have a profile bundle with:

1. `checkpointProfileId`
2. prompt dialect/template family
3. tag ordering policy (`checkpoint_default` order)
4. tag-to-prompt mappings (positive/negative fragments, precedence)
5. baseline profile compatibility list/default
6. quality/routing defaults (optional)

When a user switches checkpoint in the UI, backend resolver must switch to the checkpoint profile bundle automatically unless explicit spec override is set.

## Local machine note (`copax` + `pony`)

If this machine has only `copax` and `pony`:

1. onboard both as separate checkpoint profiles
2. define separate baseline profile families per checkpoint
3. define separate tag prompt order maps per checkpoint
4. for Pony: set `vaeWeights` and `defaultGenerationParams.clip_skip = 2`
5. verify one sample spec per major asset class on both checkpoints before bulk recreation

## Data and seed workflow

- `data/` is gitignored and holds runtime project data.
- `examples/` is committed and contains curated seed data (the source of truth for bootstrapping).
- Run `npm run seed` (or `npm run seed --force` to overwrite) to copy `examples/` into `data/`.
- When onboarding a new checkpoint, add its JSON to `examples/<projectId>/checkpoints/` so it ships with the repo.
