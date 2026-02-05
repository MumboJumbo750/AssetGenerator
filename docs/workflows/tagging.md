# Workflow: tagging and catalogs

## Goals

- Fast tagging (one-click chips)
- Consistent vocabulary across projects/checkpoints
- Enable filtering (datasets, exports, search)

## What to tag at each stage (checklist)

### Spec stage (AssetSpec.tags)

Purpose: define intent and enable filtering.

- Always: `assetType:*`
- Usually: `style:*`, `scenario:*` (or enforce via project defaults)
- Common: `ui:*`, `level:*`, `enemy:*`, `boss:*`, `vfx:*`, `tileable`

### Output stage (Asset variant tags)

Purpose: record what the image actually is + QC signals.

- Quality: `quality:*`
- Issues (don’t train/export): `issue:*`
- Selection: use `variants[].status` + `primaryVariantId`

### Training stage

Purpose: captions/tokens.

- Include only curated tags that are consistent and meaningful.
- Exclude issue tags and rejected variants.

For rationale + examples: `docs/faq.md`.

## Tag system design (initial)

Tags are **catalog-driven** and can exist at three levels:

1. **Project-wide tags**: default tag groups and chips
2. **Checkpoint-specific tags**: specialized tags (e.g., model-specific tokens)
3. **Spec/Asset tags**: applied to a specific spec or asset

### Tag groups

Tags should be presented in groups in the UI:

- `style` (drawn, realistic, anime, cartoon, comic, …)
- `scenario` (sci-fi, fantasy, cyberpunk, …)
- `assetType` (character, prop, tile, texture, overlay, ui_icon, logo, spritesheet, …)
- optional: `material`, `color`, `lighting`, `camera`, `mood`, `era`, `faction`

Each tag can have:

- `id` (stable)
- `label` (human)
- `promptToken` (optional token/text to inject into prompts)
- `aliases` (for search)

## Click-to-tag UX

- Chips add/remove tags immediately.
- Chips can be “exclusive” inside a group (e.g., only one style).
- Provide “recommended tags” per assetType and per checkpoint.

## Prompt composition

Prompt text is generated from:

- spec prompt + tag promptTokens + style/scenario defaults + checkpoint templates

Prompt examples (positive/negative) are stored per spec for transparency and reproducibility.
