# Roadmap

This roadmap is checkpoint-driven: each checkpoint should end with a demo-able, end-to-end flow.

Status legend:
- DONE: implemented in repo today
- PARTIAL: implemented, but missing key UX/admin pieces
- NEXT: recommended next checkpoint to execute
- PLANNED: later

See also:
- Current gaps / next decisions: `docs/gaps.md`
- Workflow docs: `docs/workflows/*`

## Where we are (summary)
Current state (as of 2026-02-04):
- Backend/worker/frontend scaffolds are running, with schema validation and a basic job system.
- Job logs + system logs are available and visible in the UI.
- ComfyUI adapter works (submit/poll/download) and a basic template+bindings workflow exists.
- Background removal + atlas packing + Pixi kit export are wired through the UI with profiles, animation mappings, and export orchestration.

How to use this roadmap:
- Use `docs/gaps.md` as the “what’s missing” list.
- Use this roadmap as the **execution order**: each checkpoint “absorbs” a chunk of gaps and ends with a demo.

## Checkpoint 0 (DONE): bootstrap + tooling
- Monorepo scaffold: `apps/backend`, `apps/worker`, `apps/frontend`
- Script hub in root `package.json` (dev/start/stop/validate/dataset)
- Port/process management helpers (`npm run ports:status`, `npm run ports:kill`, ComfyUI stop/restart)
- Repo-local Python venvs for tooling (ComfyUI + background removal) to avoid global "Python mess"
- CI: `npm run validate:data` + `npm run typecheck`
- Working worker stages: `generate`, `bg_remove`, `atlas_pack`, `export` (Pixi kit)
- Frontend has a basic PixiJS preview that loads a kit manifest

Demo:
- `npm run dev`
- (Optional) `npm run comfyui:setup && npm run comfyui:start`

## Checkpoint A (DONE): data-first foundation
Done:
- JSON schemas in `schemas/` (projects, specs, assets, jobs, atlases, exports)
- Data validator (AJV) for `data/**.json`
- ADRs for data-first DB, ComfyUI, and LoRA scopes/variants
- Seed script + demo data project: `npm run seed` (AstroDuck demo)
- ID + rename/migration rules (tags, assetTypes, checkpoints, loras): `docs/data/id-governance.md` + `npm run migrate:rename-id`

Missing:
- (none)

Demo:
- `POST /api/projects` creates a project and starter catalogs
- `npm run validate:data` passes with the sample `data/`

## Checkpoint B (DONE): backend API + job system
Done:
- CRUD-ish routes for projects/catalogs/spec-lists/specs/assets/jobs
- Schema validation on write
- Per-job logs (`job.logPath`) + system runtime logs (backend/worker) visible in UI
- Import endpoint + script for bulk asset ingest
- Job cancellation + retry semantics (worker honors `status=canceled`)

Missing:
- (none)
- Optional (later): websocket job updates

Demo:
- Create a spec, enqueue a generate job, observe job record lifecycle

## Checkpoint C (DONE): frontend "spec to asset" workflow
Done:
- Basic project picker and list views
- Basic Pixi kit preview panel
- System status panel (Comfy reachable, worker running, weights resolved)
- App shell redesign + Mantine UI framework
- Cyberpunk design system + UX workflow docs
- Routed UI layout with page-level views (Overview/Specs/Assets/Jobs/Pixi/Logs)
- SpecList editor + basic refinement (SpecList -> AssetSpecs)
- Job queue view (queued/running/failed) with per-job details
- Asset gallery basics with tagging chips + rating/status + set primary
- Guided UX layer: in-app guidance doc + empty states + next-action CTAs + help tips
- Help Center page with searchable topics + detail view
- Help tips deep-linked to FAQ topics + expanded review/filter guidance
- Empty-state polish for Specs/Assets review flow
- Spec templates for common patterns (ui_icon / tileable texture / spritesheet)
- Asset preview zoom + alpha checkerboard background
- Asset gallery search/filter (tags/status/assetType/text)
- Bulk approve/reject flows
- Bulk tag actions (add/remove)
- Bulk regenerate (queue generate jobs for selected assets)

Missing:
- (none)

Demo:
- Write a SpecList, refine into specs, generate variants, approve a primary, then export

## Checkpoint D (DONE): generation pipeline (ComfyUI)
Done:
- ComfyUI adapter (submit prompt, poll history, download outputs)
- Workflow templates + bindings support under `pipeline/comfyui/workflows/`
- ComfyUI environment verification endpoint + UI panel
- Onboarding wizard steps (Overview)
- Template-driven prompt rendering from AssetSpecs
- Best-effort custom node check via ComfyUI object_info
- Manifest validation for custom node IDs + python packages (requires pythonBin)
- Model/checkpoint/LoRA hash verification (optional)
- Pipeline orchestration primitives:
  - chained jobs (generate -> bg_remove -> atlas_pack -> export)
  - per-project concurrency limits + locking
  - deterministic naming via explicit asset/atlas/export IDs

Demo:
- Create a spec and generate with a selected checkpoint + LoRAs using a template workflow

## Checkpoint E (DONE): review + tagging + variants
Done:
- Tag chips from catalogs, including exclusive groups
- "Primary variant" selection rules and UI (primary selection + status/rating controls)
- Saved filters and quick search presets (Assets review)
- Version status control (draft/review/approved/rejected/deprecated)
- Review notes/audit fields for approvals/rejections

Missing:
- (none)

Demo:
- Review 20 variants quickly and end with a clean, approved set

## Checkpoint F (DONE): background removal (alpha)
Done:
- Worker stage for background removal via repo-local Python (`rembg`)
- Expose bg removal parameters in UI/job input (threshold/feather/erode)
- Store parameters under `variant.processing` and keep artifacts reproducible
- Mask/alpha preview in UI
- Batch background-removal jobs for "all approved variants in selection"
- Persist results back into the Asset JSON (write `alphaPath` into the correct variant)

Demo:
- Approve a variant, run bg removal, compare original vs alpha

## Checkpoint G (DONE): spritesheets/atlases + animation authoring
Done:
- Atlas pack worker (writes Pixi spritesheet JSON + an engine-agnostic atlas record)
- Atlas settings (padding + max size)
- UI to pick frames, reorder, and define animation metadata (fps/loop/frame order)
- Preview: atlas image + frame rects + animation playback
- Link animation metadata back to AssetSpecs (output.kind=animation)

Missing:
- (none)
- (none)

Demo:
- Pack an animation atlas and preview it in the frontend

## Checkpoint H (DONE): LoRA training + releases
Done:
- Dataset manifest builder (basic)
- Dataset query/filter rules (status/assetType/checkpoint/tags)
- Caption strategies with optional prompt tokens + checkpoint-scoped catalogs
- Training runner adapter (records candidate releases + config metadata)
- Kohya training backend adapter wiring + setup script
- Eval grid storage scaffolding + LoRA release linkage
- Eval comparison UI (read-only)
- Eval grid generation (queued jobs + worker writes outputs)
- LoRA release model (baseline/shared vs project-scoped) in schemas + ADRs
- Richer comparison UI (sorting, side-by-side, metrics)
- LoRA admin UI:
  - publish/approve/deprecate releases
  - recommend by assetType + checkpoint
  - handle "baseline LoRA first, project LoRA later" as a first-class workflow

Missing:
- (none)

Demo:
- Train a baseline LoRA release and use it in generation for an assetType

## Checkpoint I (DONE): exports + PixiJS kit
Done:
- Export profiles (apply scale/trim/padding/naming)
- Export UI (profile selection, asset/atlas selection, animation + UI mapping)
- Pixi kit export generates manifest + minimal TypeScript helpers
- Support exporting animation + UI recipes into the manifest

Missing:
- (none)

Demo:
- Export a Pixi kit and validate it in Pixi preview using the manifest path

## Checkpoint J (DONE): administration console + governance
Done:
- Admin UI for:
  - catalogs (styles/scenarios/palettes/tags/assetTypes)
  - checkpoints (prompt templates + examples)
  - LoRAs (baseline + project, releases, recommendations)
  - export profiles
- Provenance/licensing fields for imported assets and training datasets

Missing:
- (none)

Demo:
- Add a new checkpoint + recommended LoRA and see it appear in selectors without code changes

## Checkpoint K (DONE): collaboration + reliability hardening
Done:
- Git LFS onboarding checks and docs ("new dev" command)
- Conflict minimization strategy for assets/versions
- Backup/snapshot scripts for `data/`

Missing:
- (none)

Demo:
- Two people can add assets in parallel with minimal conflicts

## Maintenance (DONE): optional lint/format hooks
Done:
- Prettier config + format scripts
- Husky + lint-staged pre-commit formatting

Missing:
- (none)

Demo:
- `npm run format`

## Executable “next steps” (recommended sequence)
If we follow the roadmap strictly, the next checkpoints to execute are:
1) **Feature expansion**: choose the next product slice (e.g., multi-user auth, audits, or workflow automation).
