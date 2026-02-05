# Workflow: SpecList -> AssetSpecs (refinement)

## Goal

Turn a user’s “SpecList” (free text) into structured, reproducible AssetSpecs that the app can generate from.

See also: `docs/how-to-spec.md`.

## Inputs (SpecList)

Typically includes:

- asset types and counts (e.g., “10 cyberpunk props”)
- constraints (camera angle, size, palette, silhouettes)
- “must have / must not have”
- references (optional)

Persistence:

- Save the original SpecList text as `data/projects/<projectId>/spec-lists/<specListId>.json` (schema: `schemas/spec-list.schema.json`).

## Output (AssetSpecs)

Each AssetSpec should be self-contained:

- `assetType`: drives UI fields + default LoRA selection
- `title`: short human name
- `style` / `scenario`: default from project, override per spec
- `tags`: from project tag groups + spec-specific tags
- `checkpointId` (optional): explicit, else determined by rules
- `loraIds` (optional): explicit, else determined by assetType rules
- `prompt.positive` / `prompt.negative`: concrete examples stored for traceability
- `generationParams`: size/steps/sampler/seed strategy
- `specListId`: link back to the originating SpecList for auditability

## Recommended refinement questions (UI-assisted)

- What is the assetType (character/prop/tile/texture/overlay/ui_icon/logo/spritesheet/…)?
- What is the viewpoint (front/side/3/4/topdown/isometric)?
- Is it single object, multi-part, or a sheet (states/frames)?
- What background policy (transparent needed?).
- What palette constraints (project palette, limited colors, faction colors)?
- What style/scenario defaults apply; what overrides are needed?
- Which tags must be present for dataset/filtering later?

## AssetType notes (initial)

- `logo`: define wordmark/symbol, variants (mono/light/dark), and background transparency.
- `ui_icon`: define size + readability constraints; avoid text by default.
- `spritesheet`: define frame count/order, fps/loop, consistent scale/camera.

## Acceptance criteria

An AssetSpec is “ready” when:

- required fields are filled
- the prompt example reads correctly for the intended checkpoint
- tags are chosen from catalogs (not free-typed unless explicitly allowed)
