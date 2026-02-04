# JSON schemas

Schemas live in `schemas/` and define the repo’s “database contract”.

## Why schemas
- The backend can validate reads/writes.
- The UI can safely rely on fields existing.
- PRs can be reviewed with confidence.

## Current schema set (initial)
- `schemas/project.schema.json`
- `schemas/catalog.asset-types.schema.json`
- `schemas/catalog.styles.schema.json`
- `schemas/catalog.scenarios.schema.json`
- `schemas/catalog.palettes.schema.json`
- `schemas/catalog.tags.schema.json`
- `schemas/checkpoint.schema.json`
- `schemas/lora.schema.json`
- `schemas/asset-spec.schema.json`
- `schemas/asset.schema.json`
- `schemas/job.schema.json`
- `schemas/atlas.schema.json`
- `schemas/export.schema.json`
- `schemas/export-profile.schema.json`
- `schemas/pixi-kit-manifest.schema.json`
- `schemas/spec-list.schema.json`
- `schemas/dataset-manifest.schema.json`

Additional (non-versioned local config):
- `schemas/local-config.schema.json`

## Conventions
- All objects include `id`, `createdAt`, `updatedAt` (ISO 8601).
- Prefer explicit enums for `assetType`, `style`, `scenario` where possible.
- Store prompt templates as strings with placeholders (documented per schema).
