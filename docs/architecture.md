# Architecture (proposed)

## High-level components

1. **Frontend (web app)**
   - Projects dashboard
   - Spec intake/refinement (SpecList -> AssetSpecs)
   - Generation queue + progress
   - Image gallery (variants, compare, tag chips, approve)
   - PixiJS preview (sprites/animations/UI kits)
   - Admin: checkpoints, LoRAs, catalogs, export profiles

2. **Backend API**
   - Reads/writes JSON “database” in `data/`
   - Validates against JSON Schemas
   - **Service layer** in `apps/backend/src/services/*` for domain logic
   - Service registry barrel in `apps/backend/src/services/index.ts`
   - Manages jobs (generate, remove background, stitch spritesheet, export)
   - Streams job logs/status to frontend

3. **Pipeline workers**
   - **Generation worker**: creates image variants using selected checkpoint + LoRAs
   - **Post-processing worker**: background removal, trims, upscales (optional)
   - **Atlas worker**: packs spritesheets and writes atlas metadata
   - **Export worker**: builds engine kits (PixiJS first)

## Tech stack (initial)

- Backend: Node.js + TypeScript
- Frontend: TypeScript (web)
- Workers: Node.js + TypeScript
- Generation backend: ComfyUI
- Optional tooling: Python only behind adapters (when needed)

## Data-first storage

All “business objects” are JSON files under `data/`:

- Humans can review changes in PRs
- Git history becomes your audit log
- The UI is driven by the JSON catalogs + schemas

Binary files:

- Small images can be committed directly (team choice)
- Larger image sets can use Git LFS
- Model weights should be kept outside Git; JSON stores references/paths

See `docs/data/README.md`.

## Job model (conceptual)

- Jobs are append-only records with:
  - job type (`generate`, `bg_remove`, `atlas_pack`, `export`)
  - inputs (specId, assetId, checkpointId, loraIds, params)
  - outputs (file paths, derived asset versions)
  - logs + timestamps + status

## “Make it appear in the UI”

The UI should be driven by catalogs in JSON:

- Add a checkpoint JSON -> it becomes selectable
- Add tag groups -> chips appear
- Add style/scenario catalogs -> selectable lists update

This requires strong schemas + validation and stable IDs.

## Frontend architecture (current)

- Routed pages in `apps/frontend/src/ui/pages/*`
- Layout shell in `apps/frontend/src/ui/layouts/*`
- Shared data in `AppDataProvider` + `useAppData`
- Shared hooks in `apps/frontend/src/ui/hooks/*`
- View models in `apps/frontend/src/ui/types/viewModels.ts`
