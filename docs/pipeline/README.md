# Image pipeline overview

## Stages

1. Generate originals (variants)
2. Review + tagging + approval
3. Background removal (alpha) for approved images
4. Optional transforms (trim, padding, upscale)
5. Spritesheet stitching (atlas packing)
6. Export bundle

## Determinism and traceability

Every derived artifact should link back to:

- `projectId`, `specId`, `assetId`
- generation settings (checkpoint, LoRAs, prompt, seed)
- processing parameters (bg removal model/settings, packing settings)

## File naming

Use stable IDs in paths; avoid user-facing titles in filenames.
