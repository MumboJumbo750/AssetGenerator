# Workflow: checkpoint onboarding (make it usable in UI)

## Goal

Adding a checkpoint should require **no code changes** to appear in the UI:
only new JSON metadata + (optionally) local model weights.

## Steps

1. Add checkpoint metadata JSON:
   - `data/projects/<projectId>/checkpoints/<checkpointId>.json`
2. Define:
   - supported `assetTypes` (must match the project asset type catalog)
   - prompt templates (global, and/or per assetType)
   - default generation params (size/steps/sampler)
   - optional checkpoint-specific tags/tokens
   - weights reference (`weights` preferred, `localPath` deprecated) and configure `config/local.json` if using `config_relative`
3. (Optional) Add recommended LoRAs for this checkpoint:
   - Baseline: `data/shared/loras/<loraId>.json`
   - Project-specific: `data/projects/<projectId>/loras/<loraId>.json`
4. Verify in UI:
   - checkpoint appears in selectors
   - example positive/negative prompt renders for a spec

## Checkpoint templates

Prefer templates with placeholders, e.g.:

- `{styleTokens}`
- `{scenarioTokens}`
- `{assetTypeTokens}`
- `{specPrompt}`
- `{tagTokens}`
- `{negTokens}`

The backend should render templates deterministically and store the resolved prompt used for each generated image.
