# Catalogs (styles, scenarios, palettes, tags)

Catalogs are project-editable JSON lists that power dropdowns, chips, and defaults in the UI.

## Asset types
Asset types define the allowed values for `AssetSpec.assetType` and drive:
- which UI fields are shown
- default generation parameters
- suggested LoRA selection and workflows (e.g., multi-frame spritesheets)

File (proposed):
- `data/projects/<projectId>/catalogs/asset-types.json` (schema: `schemas/catalog.asset-types.schema.json`)

Guideline:
- keep asset types stable; prefer adding new types over renaming existing IDs

## Scope rules
Catalog entries can exist at different scopes:
- **Project scope**: default lists shared by everything in the project.
- **Checkpoint scope** (optional): overrides/extends lists for one checkpoint (useful for model-specific tokens).

Design guideline:
- Start with **project scope**.
- Add checkpoint scope only when a checkpoint needs special tokens or different defaults.

Checkpoint-scoped catalogs live at:
- `data/projects/<projectId>/catalogs/checkpoints/<checkpointId>/styles.json`
- `data/projects/<projectId>/catalogs/checkpoints/<checkpointId>/scenarios.json`
- `data/projects/<projectId>/catalogs/checkpoints/<checkpointId>/tags.json`

## Styles
Style = rendering approach (how it looks), e.g.:
- drawn, realistic, anime, cartoon, comic, pixel-art, watercolor, …

File (proposed):
- `data/projects/<projectId>/catalogs/styles.json` (schema: `schemas/catalog.styles.schema.json`)

UI behavior:
- usually exclusive (pick one primary style)
- style can also add prompt tokens

## Scenarios
Scenario = world/setting theme (what it is), e.g.:
- sci-fi, fantasy, cyberpunk, post-apocalyptic, medieval, …

File (proposed):
- `data/projects/<projectId>/catalogs/scenarios.json` (schema: `schemas/catalog.scenarios.schema.json`)

UI behavior:
- can be exclusive (one setting) or multi-select (hybrid) depending on project preference

## Palettes
Palettes are named color sets used to keep assets coherent across a project.

File (proposed):
- `data/projects/<projectId>/catalogs/palettes.json` (schema: `schemas/catalog.palettes.schema.json`)

Potential uses:
- tag chips (e.g., “Faction A colors”)
- prompt composition (e.g., “limited palette: …”)
- validation hints (e.g., enforce accent colors)

## Tags (general)
Tags are the most flexible concept:
- searchable labels for assets/specs
- optional prompt tokens
- can be grouped and shown as clickable chips

File (proposed):
- `data/projects/<projectId>/catalogs/tags.json` (schema: `schemas/catalog.tags.schema.json`)

See `docs/workflows/tagging.md`.
