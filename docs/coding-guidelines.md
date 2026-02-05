# Coding guidelines (team standard)

This document consolidates the repo's best practices for code, data, and workflow.
It is meant to be **practical**: follow these to keep the system stable and predictable.

## 1) Architecture rules (non-negotiable)

- **Data-first JSON DB**: `data/` is the source of truth.
- **No hardcoded catalogs** in UI or worker code.
- **Schema-first**: if the schema changes, update docs + add an ADR if behavior changes.
- **Repo-local Python** only behind adapters (no global env reliance).

## 2) Project structure & ownership

- `apps/backend`: API + JSON validation + job endpoints
- `apps/worker`: job execution and pipeline adapters
- `apps/frontend`: UI
- `schemas/`: JSON contracts (source of truth)
- `docs/`: plan + workflows + ADRs
- `pipeline/`: ComfyUI workflows + manifests
- `tools/`: repo-local Python venvs and helper scripts
- `apps/backend/src/services/*`: domain services (file IO + validation + business logic)

## 3) Data contract rules

- Every JSON file under `data/` must validate against a schema in `schemas/`.
- IDs are **stable**; avoid renames unless a migration is planned.
- Don't commit model weights; store references via `config/local.json`.
- Binary assets belong under `data/projects/<id>/files/` and are Git LFS-tracked.

## 4) TypeScript & API practices

- Prefer explicit types and schema-aligned shapes.
- **Backend writes validate** against schemas before persisting.
- **Frontend reads catalogs dynamically** (no UI hardcoding).
- Handle errors consistently: return useful messages (job error + logs).
- **Service-first backend**: routes should be thin and delegate to `services/`.

## 5) Logging & error visibility

- Every job writes a JSONL log and sets `job.logPath`.
- Runtime/service logs (backend/worker) are kept in `data/runtime/logs/`.
- Keep logs **redacted** (no secrets, no absolute model paths).
- UI should always show: job error + log tail (and system logs view).

See: `docs/setup/logging.md`.

## 6) Pipeline & generation

- ComfyUI workflows live under `pipeline/comfyui/workflows/`.
- Use templates + bindings, not raw workflow blobs in UI.
- Save resolved prompts/settings into asset versions (reproducibility).
- Post-processing updates asset variants (alphaPath, processing params).

## 7) UI/UX rules (baseline)

- Asset lists should support quick actions (tag/approve/regenerate).
- Gallery must make alpha visibility obvious (checkerboard).
- Job queue view must be visible and debuggable.
- PixiJS kit preview uses the same manifest as export.

## 8) Frontend architecture & UI standards (mandatory)

- **No god files**: `App.tsx` should only wire providers + layout + routes.
- **Page-first structure** (suggested):
  - `apps/frontend/src/ui/pages/*` (route-level views)
  - `apps/frontend/src/ui/components/*` (reusable UI pieces)
  - `apps/frontend/src/ui/layouts/*` (AppShell + navigation)
  - `apps/frontend/src/ui/hooks/*` (data fetching, derived state)
  - `apps/frontend/src/ui/pixi/*` (feature folder: Pixi preview hooks + types)
  - `apps/frontend/src/ui/api.ts` (API boundary)
- **Shared data**: use `AppDataProvider` + `useAppData` for project-scoped data.
- **Hooks for shared workflows**: async actions and selection should live in `apps/frontend/src/ui/hooks/*`.
- **View models**: define UI-facing shapes in `apps/frontend/src/ui/types/viewModels.ts`.
- **Routing required**: one route per major workflow page (Overview, Specs, Assets, Jobs, Pixi, Logs).
- **Component library**: use **Mantine** for UI primitives (Buttons, Cards, Inputs, AppShell).
- **Consistent spacing**: rely on `Stack`, `Group`, `SimpleGrid` and Mantine spacing tokens.
- **State boundaries**: page-local state stays in the page; shared logic moves to hooks.
- **No inline mega styles**: prefer Mantine props or minimal CSS in `ui/styles.css`.
- **DRY data flow**: fetch data via hooks; keep API calls centralized.

## 9) UI theming

- Theme lives in one place (e.g. `apps/frontend/src/main.tsx` or `ui/theme.ts`).
- Use a small set of brand tokens (primary color, radius, font).
- Keep contrast high and text sizes readable.
- Design tokens + element usage live in `docs/ui/design-system.md`.

## 10) Git hygiene

- `config/local.json` and model weights are **never committed**.
- Keep large binaries in Git LFS (`.gitattributes`).
- Use `feat/<topic>` branches; `main` is always runnable.

## 11) Testing & validation

- Always run:
  - `npm run validate:data`
  - `npm run typecheck`
- CI enforces the same checks.

## 12) When adding features

- Update the relevant workflow doc.
- Update `docs/roadmap.md` and `docs/gaps.md` if scope changes.
- Prefer minimal, incremental changes that maintain compatibility.
