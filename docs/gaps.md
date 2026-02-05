# Current gaps / next decisions

This is a living checklist of the most obvious missing pieces before the plan becomes a fully executable implementation.

How to use this file:

- Treat each section as work that should be absorbed by roadmap checkpoints in `docs/roadmap.md`.
- Recommended execution order (high level): A (seed data) -> C (UX) -> D (Comfy hardening) -> F/G/I (pipeline UX + exports) -> H (training).

## 1) App feature completeness

We now have minimal scaffolds for:

- backend (`apps/backend`)
- worker (`apps/worker`)
- frontend (`apps/frontend`)
  We also have a seeded demo project:
- `npm run seed` (AstroDuck demo under `data/projects/astroduck_demo/`)

Still missing (core product features):

- In-app guidance/onboarding so users feel guided (empty states, templates, tooltips, system status): `docs/ui/in-app-guidance.md`
- Spec CRUD + refinement UI (SpecList -> AssetSpecs wizard)
- Asset gallery with tagging chips + approve/reject/version flow
- Admin UI (checkpoints, LoRAs, catalogs, export profiles)
- Job progress + logs UI (polling is fine for now; websockets later)
- Job cancellation + retry semantics (and worker honoring `status=canceled`)
- Bulk actions (generate/bg-remove/pack/export across selections)

## 2) ComfyUI integration gaps

- Worker includes a basic ComfyUI adapter (submit -> poll history -> download outputs).
- Custom node installer exists: `npm run comfyui:nodes` (from `pipeline/comfyui/manifest.json`).
- Generation supports workflow templates + bindings injection when `job.input.workflow` is omitted (`pipeline/comfyui/workflows/*.json`).

Still missing:

- Verify required model files exist (and optionally hashes) based on the manifest + local config roots
- Install node-specific Python requirements into the ComfyUI venv (requirements.txt handling)
- Spec-first prompt/workflow rendering from AssetSpecs (checkpoint templates, tag/style/scenario token catalogs)
- Persist the resolved workflow + resolved prompts/settings per generated asset version (reproducibility)
- Progress reporting via websocket (optional)

## 3) Background removal + atlas packing tool choices

- Implemented:
  - Background removal uses a repo-local Python venv + `rembg` (`tools/python/bg_remove.py`)
  - Atlas packing implemented via `sharp` + `maxrects-packer` (writes Pixi spritesheet JSON + engine-agnostic atlas record)

Still missing:

- (none)
- Atlas settings (max size, POT, trim/extrude) and deterministic packing rules

## 4) Catalog + ID governance

- Starter catalogs are now auto-created when you POST a new project.

Now defined:

- Naming/ID conventions and a migration rule for renames: `docs/data/id-governance.md` + `npm run migrate:rename-id`

Still missing:

- Add import/export of catalogs between projects (optional, but useful).

## 5) SpecList -> AssetSpecs refinement implementation

- We defined `spec-lists/` and `specListId` linkage, but the refinement UI and its “question flow” is not implemented.
- Decide whether refinement is:
  - manual form-only
  - assisted (templates + suggestions)
  - LLM-assisted (optional, later)

## 6) Dataset manifests + training runner

- Implemented:
  - dataset builder command (basic): `npm run dataset:build -- --project <projectId>`
  - filtering/tag queries + caption strategies
  - training runner adapter (records candidate releases): `npm run lora:train -- --lora <loraId> --dataset <datasetId|path>`
  - kohya_ss setup + adapter wiring: `npm run lora:setup` + `npm run lora:train -- --adapter kohya_ss --run`
  - eval grid storage scaffolding: `npm run lora:eval -- --lora <loraId> --release <releaseId>`
  - eval comparison UI (read-only): `/training`
  - eval grid generation (queued jobs + worker updates): `npm run lora:eval-grid -- --project <projectId> --lora <loraId> --release <releaseId>`

Still missing:

- richer comparison UI for LoRA releases

## 7) Export profiles + kit build

- Implemented:
  - export worker builds a Pixi kit folder (images + atlases + manifest) and writes an `export.json` record.
  - export profiles + profile UI (scale/trim/padding/naming)
  - kit runtime helpers (`loadKit`, `createSprite`, `createAnimation`, `createUiElement`)
  - export UI for animation + UI state mappings

Still missing:

- (none)

## 8) Collaboration/CI

- Implemented:
  - `npm run validate:data` (AJV)
  - GitHub Actions runs validation + typecheck (`.github/workflows/ci.yml`)

Still missing:

- Optional: formatting and pre-commit hooks (prettier/eslint) once code stabilizes
- Consider merge-conflict minimization:
  - asset `versions[]` arrays can conflict if multiple people edit the same asset; consider per-version files if this becomes a problem.

## 9) Licensing / provenance (recommended)

- For imported assets and training datasets, we should store source/provenance fields:
  - license, origin, allowed-for-training/export flags

## 10) Logging / observability (recommended)

We need logs that are visible in the UI so failures across connected systems are debuggable.

Still missing:

- UI polish: parse JSONL into structured rows (level filter/search), plus copy/download actions
- UI error boundary that captures frontend crashes and persists an event/log entry
- Runtime logs for ComfyUI start/stop (optional) and other adapters beyond bg_remove
- Log retention/cleanup tooling (keep last N days/MB)

## 11) Demo game (recommended)

We have a demo spec pack for AstroDuck, but we still need a small runnable PixiJS demo game to validate:

- the exported Pixi kit is truly drop-in usable
- animation definitions and UI state recipes work as expected
- atlas packing decisions (padding/trim) don’t cause runtime artifacts

Still missing:

- A dedicated demo app (e.g. `apps/demo-game`) that loads an export manifest and previews sprites/animations/UI states in a game-like loop
- A stable mapping from AssetSpecs to kit logical names (so code doesn’t reference internal IDs)

## 12) Audio pipeline (later)

The demo includes music/SFX needs, but the pipeline is image-first today.

Still missing:

- Schema(s) + storage conventions for audio assets (wav/ogg) and their metadata
- A worker adapter for audio generation (or import workflow) and preview in UI

## 13) Text/encoding cleanup (nice-to-have)

Some UI strings and older docs show mojibake (e.g. `Â·`, `â€”`) from encoding issues.
We should normalize to UTF-8 and fix the visible UI glyphs.

- UI error boundary that captures frontend crashes and persists an event/log entry
