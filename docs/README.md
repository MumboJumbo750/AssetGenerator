# Docs index

This repository is intentionally **data-first**: the project database is versioned JSON in `data/` so the app can be moved via Git and everyone shares the same specs, tags, and asset metadata.

## Goals

- Create assets from structured specs (not ad-hoc prompts)
- Support multiple model checkpoints and per-checkpoint LoRAs
- Make review/tagging fast (clickable prepared tags)
- Keep assets organized and reproducible (inputs, prompts, seeds, outputs)
- Enable background removal (alpha) and spritesheet stitching

## Table of contents

- Vision and scope: `docs/vision.md`
- Architecture: `docs/architecture.md` (includes services + frontend layering)
- Backend services: `docs/backend/services.md`
- Data model and storage: `docs/data/README.md`
- Catalogs (styles/scenarios/tags/palettes): `docs/data/catalogs.md`
- JSON schemas: `docs/data/schemas.md`
- How to spec (SpecList template): `docs/how-to-spec.md`
- FAQ (tagging + LoRA basics): `docs/faq.md`
- Coding guidelines (team standard): `docs/coding-guidelines.md`
- Roadmap: `docs/roadmap.md`
- Gaps / next decisions: `docs/gaps.md`
- Demo project (AstroDuck): `docs/demo/astroduck/README.md`
- Decisions (ADRs): `docs/decisions/README.md`
- Storage (Git LFS): `docs/storage/git-lfs.md`
- Collaboration: `docs/collaboration/conflict-strategy.md`
- Setup
  - Local config (ComfyUI + model paths): `docs/setup/local-config.md`
  - ComfyUI setup: `docs/setup/comfyui.md`
  - Script hub: `docs/setup/scripts-hub.md`
  - Validation/CI (plan): `docs/setup/validation.md`
  - Logging & error visibility: `docs/setup/logging.md`
- Workflows
  - Asset creation (spec -> generate -> review/tag -> export): `docs/workflows/asset-creation.md`
  - Asset administration (curation, versions, deprecations): `docs/workflows/asset-administration.md`
  - Spec refinement (SpecList -> AssetSpecs): `docs/workflows/spec-refinement.md`
  - Variants and versions: `docs/workflows/variants.md`
  - Checkpoint onboarding (make checkpoint available in UI): `docs/workflows/checkpoint-onboarding.md`
  - LoRA training per checkpoint: `docs/workflows/lora-training.md`
  - Tagging and catalog management: `docs/workflows/tagging.md`
  - Import existing assets: `docs/workflows/import-assets.md`
  - Export PixiJS kit: `docs/workflows/export-pixijs-kit.md`
  - Coding workflow (branches, PRs, checkpoints): `docs/workflows/coding-workflow.md`
- Image pipeline details
  - Pipeline overview: `docs/pipeline/README.md`
  - Background removal (alpha): `docs/pipeline/background-removal.md`
  - Spritesheets/atlases: `docs/pipeline/spritesheets.md`
  - Pipeline adapters: `docs/pipeline/adapters.md`
  - Atlas format: `docs/pipeline/atlas-format.md`
  - ComfyUI workflow: `docs/pipeline/comfyui.md`
  - ComfyUI environment manifest: `docs/pipeline/comfyui-environment.md`
- Exports
  - Export overview: `docs/exports/README.md`
  - PixiJS kit export: `docs/exports/pixijs-kit.md`
- UI
  - In-app guidance plan: `docs/ui/in-app-guidance.md`
  - UX workflows (noob-first): `docs/ui/ux-workflows.md`
  - Design system tokens: `docs/ui/design-system.md`
  - Frontend architecture: `docs/ui/frontend-architecture.md`

## Glossary (short)

- **Project**: the top-level container (defaults, shared catalogs, assets).
- **SpecList**: a user’s “wishlist” in natural language, refined into structured **AssetSpecs**.
- **AssetSpec**: structured definition of one asset to generate (type, style, scenario, prompts, tags).
- **Asset**: an instance/result produced from a spec (images, variants, metadata).
- **Checkpoint**: a base model configuration usable for generation.
- **LoRA**: fine-tune module trained for a checkpoint, usually tied to an asset type/style.
- **Catalog**: curated lists like styles, scenarios, tag groups, palettes.
