# Workflow: export PixiJS kit

## Goal
Create a drop-in folder that includes:
- final images/atlases
- a manifest describing sprites/animations/UI elements
- generated TypeScript helpers for easy consumption

## Selection
User chooses:
- project
- export profile (stored in `data/projects/<projectId>/export-profiles/<profileId>.json`)
- assets to include (default: `status: approved`)
- atlases to include (for animation/UI state exports)
- animation specs mapped to an atlas
- UI state specs mapped to texture keys or atlas frames

## Build steps
1) Gather inputs
   - single-image assets (alpha PNG preferred)
   - atlases for animated/stateful assets
   - animation + UI mappings from specs
   - resolve any warnings (missing atlas or UI-state mappings)
2) Copy/normalize outputs into:
   - `data/projects/<projectId>/files/exports/<exportId>/pixi-kit/`
3) Generate `manifest.json` (see `schemas/pixi-kit-manifest.schema.json`)
4) Generate TS kit (`src/index.ts`, `src/runtime.ts`, `src/types.ts`)
5) Write an `export.json` record (see `schemas/export.schema.json`)
   - include `profileId`
   - optionally include `profileSnapshot` for reproducibility

## Output validation
- manifest validates against schema
- all referenced files exist
- animation frame keys exist in atlas metadata

## Preview reuse
The frontend preview should load the same `manifest.json` + files to avoid drift between “preview” and “export”.
