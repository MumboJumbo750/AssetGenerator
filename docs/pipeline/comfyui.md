# ComfyUI workflow (generation)

## Goal

Use ComfyUI as the generation engine, while keeping our app “spec-first” and reproducible.

Setup and runtime:

- `docs/setup/comfyui.md`
- `docs/setup/scripts-hub.md`

## How it works (concept)

1. User creates/edits an AssetSpec (style/scenario/tags/prompts, assetType).
2. Backend resolves:
   - checkpoint + LoRAs to use (from spec + project defaults)
   - resolved positive/negative prompt (templates + tags)
   - generation params (size/steps/sampler/seed)
3. Generation worker renders a ComfyUI workflow template by injecting those values.
4. Worker submits the workflow to ComfyUI, polls progress, and saves outputs.
5. Asset metadata stores:
   - resolved prompts
   - seed(s)
   - checkpoint/LoRA IDs + versions
   - the workflow template ID + rendered workflow JSON (or hash)

## In-repo workflow templates

Store templates in a predictable folder:

```
pipeline/comfyui/workflows/
  base-txt2img.json
  assetType/
    character.json
    prop.json
    ui_icon.json
```

Templates should be treated like code:

- reviewed in PRs
- versioned
- referenced by stable `workflowTemplateId` in jobs/assets

Current repo includes a starter template:

- `pipeline/comfyui/workflows/txt2img.json`
- `pipeline/comfyui/workflows/txt2img.bindings.json`

## Template parameter convention

Avoid “magic node IDs” sprinkled across the code. Maintain a small mapping per template:

- which nodes/inputs represent: prompt, negative prompt, seed, model, loras, width/height, steps, cfg, sampler

Suggested approach:

- Keep a sidecar “bindings” file per template (simple JSON).
- The adapter uses bindings to perform injections.

Example bindings shape (conceptual):

- `promptNode`: node id + input name
- `negativePromptNode`: node id + input name
- `seedNode`: node id + input name
- `checkpointNode`: node id + input name
- `loraNodes`: list of node ids

## Multiple checkpoints and per-checkpoint LoRAs

Rules:

- A LoRA references a single `checkpointId` (see `schemas/lora.schema.json`).
- UI filters LoRAs by selected checkpoint + assetType.
- When adding a new checkpoint, it appears in the UI via JSON onboarding (no code).

See `docs/workflows/checkpoint-onboarding.md` and `docs/workflows/lora-training.md`.

## Reproducibility requirements

For every generated image variant, persist:

- resolved positive/negative prompt
- seed, steps, cfg, sampler, size
- checkpointId + checkpoint version (if available)
- loraIds + lora versions/weights
- workflowTemplateId + template version/hash

## Failure handling

If ComfyUI fails:

- job status becomes `failed`
- store error text and last-known progress/log path
- leave partial outputs on disk but do not mark asset as approved

## Reproducible environments

See `docs/pipeline/comfyui-environment.md` for capturing required custom nodes and model identifiers.
