# How to spec assets (SpecList -> Project JSON)

This guide helps you write “SpecLists” that convert cleanly into `data/projects/<projectId>/specs/<specId>.json` (see `schemas/asset-spec.schema.json`).

If you are recreating old specs for the automated happy loop, use this companion workflow:

- `docs/workflows/spec-recreation-happy-loop.md`

The raw SpecList should also be saved for traceability:

- `data/projects/<projectId>/spec-lists/<specListId>.json` (schema: `schemas/spec-list.schema.json`)

## 1) Write a SpecList (human input)

Use this structure (copy/paste template):

### Project context

- Game name / projectId:
- Target engine (optional):
- Default style (e.g., cartoon, anime, realistic, pixel-art):
- Default scenario (e.g., fantasy, sci-fi, cyberpunk):
- Palette constraints (optional):

### Assets needed (bulleted)

For each bullet, include:

- assetType (required): pick from the project's asset type catalog (add it first if missing), e.g. `character | prop | tile | texture | overlay | ui_icon | logo | spritesheet | ...`
- count (required): how many
- purpose (required): where it’s used (HUD, inventory, splash, etc.)
- constraints (required when relevant): size/aspect, background policy, readability, tileable, frames/fps
- must-have / must-not-have (optional)
- references (optional): links, images

### Global “do / don’t”

- Do:
- Don’t:

## 2) Refinement questions (what the app will ask)

These are the minimum questions needed to generate consistent JSON:

- What `assetType` is it?
- What is the background policy?
  - `transparent required` vs `any background ok`
- Is it single image or multi-frame?
  - If multi-frame: frame count/order + fps + looping
- What style/scenario defaults apply, and what overrides?
- Which tags are required for filtering/training/export later?

## 3) AssetType cheat sheet (what to include)

### `ui_icon`

- size (e.g., 128x128), padding, stroke weight
- silhouette clarity at small sizes
- background: transparent required (usually)
- forbidden: text, watermarks, busy gradients (usually)

### `logo`

- text/wordmark vs symbol vs combo
- aspect ratios needed (square + wide recommended)
- color variants (full color + mono + light/dark)
- background: transparent required
- forbidden: trademarked shapes/logos

### `spritesheet`

- frame size (e.g., 256x256), frame count, fps, loop yes/no
- consistent camera + scale
- background: transparent required

### `texture` / `tile`

- tileable: yes/no (if yes, specify seamless requirement)
- texel density target (optional)
- avoid directional lighting if used as a repeating tile

### `overlay`

- purpose (damage decal, glow, smoke, UI flourish)
- blending expectation (additive/alpha)
- background: transparent required

## 4) What the JSON will look like (AssetSpec)

Minimal shape (example):

```json
{
  "id": "spec_01",
  "projectId": "proj_01",
  "createdAt": "2026-02-03T00:00:00.000Z",
  "updatedAt": "2026-02-03T00:00:00.000Z",
  "title": "Inventory: health potion icon",
  "assetType": "ui_icon",
  "style": "cartoon",
  "scenario": "fantasy",
  "tags": ["assetType:ui_icon", "ui:inventory", "item:potion", "readability:high"],
  "prompt": {
    "positive": "A simple, readable red health potion icon, centered, bold silhouette, clean edges",
    "negative": "text, watermark, photo, cluttered background, blurry edges"
  },
  "generationParams": {
    "width": 512,
    "height": 512,
    "variants": 8
  },
  "status": "ready"
}
```

Notes:

- `checkpointId` and `loraIds` may be set explicitly or chosen by rules in the UI/admin.
- For autopilot-ready specs also set: `baselineProfileId`, `loraPolicy`, `styleConsistency`, `qualityContract`.
- The generator stores the _resolved_ prompts/settings per output in the Asset record (`schemas/asset.schema.json`).
