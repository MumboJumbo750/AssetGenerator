# Spritesheets / atlas packing

## Goal

Pack a set of frames into a single image atlas and produce metadata for runtime slicing.

## Inputs

- list of frame image paths (usually alpha PNGs)
- frame order (explicit)
- padding, max size, trim, extrude, POT, sort order
- pivot/origin per frame (optional, recommended)
- power-of-two constraint (optional)

## Outputs

- `atlas.png`
- `atlas.json` including:
  - frame rects (x, y, w, h)
  - source size (before trim)
  - pivot/origin (editable in UI)
  - animation groups (optional)

## Current implementation (initial)

- Worker produces:
  - `data/projects/<projectId>/files/atlases/<atlasId>/atlas.png`
  - `data/projects/<projectId>/files/atlases/<atlasId>/atlas.json` (Pixi/TexturePacker-style JSON)
  - `data/projects/<projectId>/atlases/<atlasId>.json` (engine-agnostic record; schema: `schemas/atlas.schema.json`)
- UI supports selecting approved frames, ordering them, and creating atlases with padding/max size.

## Recommended metadata fields

- `atlasId`, `projectId`
- `frames[]: {id, sourcePath, rect, sourceSize, pivot}`
- `packSettings`
