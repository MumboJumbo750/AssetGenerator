# ADR-0005: Catalog-driven asset types + project selection policies

Date: 2026-02-03

## Status
Accepted

## Context
`assetType` drives key behavior:
- which UI fields appear
- default generation settings
- pipeline workflows (single image vs spritesheet/atlas)
- LoRA recommendations (baseline vs project scope)

If `assetType` is free-form, teams will drift into inconsistent naming and the UI/pipeline will become brittle.

We also need predictable default behavior for choosing LoRAs (baseline first, then project) without hardcoding logic in the UI.

## Decision
1) Make `assetType` catalog-driven:
   - Projects maintain an `asset-types.json` catalog (validated by `schemas/catalog.asset-types.schema.json`).
   - `AssetSpec.assetType` must match a catalog entry.

2) Add project-level selection policies:
   - `project.policies.loraSelection` defines default LoRA scope ordering and release selection.

## Consequences
- Consistent asset typing across the project and a stable base for UI defaults.
- Easier to add new asset types without code changes (catalog + workflow templates).
- Requires initial catalog seeding for each project.

