# PixiJS kit export (runtime + preview)

## Goal

Generate a ready-to-use “kit” that:

- packages final PNGs + atlas metadata
- provides TypeScript interfaces/helpers to instantiate sprites/animations/UI elements
- can be imported into other PixiJS projects
- is also used by our frontend for in-app preview/quality checks

## Inputs

- Approved assets (prefer alpha PNGs)
- Atlases (`schemas/atlas.schema.json`) for animated/UI-state assets
- Export profile settings (scale, trim/padding rules, naming rules)

## Output folder structure (proposed)

```
data/projects/<projectId>/files/exports/<exportId>/pixi-kit/
  manifest.json
  assets/
    atlases/
      <atlasId>.png
      <atlasId>.json
    images/
      <assetId>.png
  src/
    index.ts
    runtime.ts
    types.ts
  package.json
  README.md
```

## Manifest (contract)

The export writes a single manifest that the kit and the preview both use:

- list of atlases and their files
- list of single-image assets
- logical names for runtime (stable + human friendly)
- animation definitions (frame lists, fps, loops)
- optional UI element “recipes” (e.g., button states)

Schema:

- `schemas/pixi-kit-manifest.schema.json`

## Codegen (TypeScript)

The export generates TS helpers to make consumption trivial:

- `loadKit()` which loads atlases/images and returns the manifest
- `createSprite(name)` for single sprites
- `createAnimation(name)` for animations (returns `AnimatedSprite`)
- `createUiElement(name)` for stateful UI components (returns a texture map)

Design constraints:

- Generated APIs must be stable and avoid leaking internal IDs.
- Names should come from spec titles + optional overrides, but IDs remain in the manifest for traceability.

## Preview in our frontend

Our frontend can reuse the kit runtime loader to preview:

- a single sprite with zoom/background checkerboard
- an animation with FPS controls and frame stepping
- UI element state switching

Implementation idea:

- The frontend uses PixiJS to render to a canvas in a preview panel.
- It reads the same `manifest.json` that the export produces (no special preview-only format).

## Why PixiJS kit first

- Works great for 2D sprites/atlases/animations
- Lightweight preview runtime inside the web frontend
- Exports are directly usable in Pixi-based game projects
