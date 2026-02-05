# Coding workflow (team)

## Goals

- Make progress in checkpoints/milestones
- Keep the JSON data contract stable
- Avoid breaking other teammates

## Branching

- `main`: always runnable
- feature branches: `feat/<topic>`

## PR checklist (minimum)

- Schema changes documented in `docs/data/schemas.md`
- Any data migration called out explicitly
- Backend validates JSON writes
- Frontend reads catalogs dynamically (no hardcoded checkpoint lists)
- JSON validation passes for `data/` (see `docs/setup/validation.md`)
- Do not commit `config/local.json` or model weight files

## Implementation checkpoints (engineering)

This is the recommended order to make the plan executable:

1. **Data contract**

- finalize JSON schemas + folder layout

2. **Minimal backend**
   - read/write projects/specs/assets
   - schema validation
3. **Minimal frontend**
   - project picker, spec list, asset gallery
4. **Job system**
   - async generation + progress
5. **Post-processing**
   - background removal (alpha)
   - spritesheet packing
6. **LoRA training workflow**
   - dataset builder + training runner + eval grids
7. **Exports**
   - engine profiles + manifests

Each checkpoint should end with:

- a demo-able user flow
- a tagged release note entry
