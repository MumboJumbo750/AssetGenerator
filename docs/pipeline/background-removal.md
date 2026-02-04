# Background removal (alpha)

## Goal
Convert approved images into PNGs with alpha transparency while preserving clean edges.

## Requirements
- Output alpha PNG must:
  - preserve the subject silhouette
  - avoid halos on transparent edges
  - optionally keep interior holes (e.g., loops)

## Suggested approach (implementation-neutral)
1) Run segmentation/matting to create a mask.
2) Post-process mask:
   - feather/erode controls
   - edge cleanup
3) Apply alpha to original.
4) Optional:
   - trim to bounds + store padding metadata

## Current implementation (initial)
- Worker runs `tools/python/bg_remove.py` using a repo-local Python venv under `tools/python/.venv/`.
- The first run installs `rembg` + `pillow` into that venv automatically.

## Parameters to expose in UI
- `threshold` / `foreground confidence`
- `feather` (px)
- `erode/dilate` (px)
- `keepShadows` (bool, later)

## Data
- Store processing parameters and the tool/version used in the asset’s metadata.
- Persist `variant.alphaPath` and `variant.processing.bg_remove` after each job.
