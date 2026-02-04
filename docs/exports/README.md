# Exports

## Goal
Exports produce a folder that can be dropped into other projects with minimal glue code.

Exports should be:
- deterministic (same inputs -> same outputs)
- self-describing (manifest JSON links assets to IDs and runtime metadata)
- engine/profile specific (PixiJS first; others later)

## Export types (initial)
- **PixiJS kit**: spritesheets + JSON manifest + generated TypeScript helpers

See `docs/exports/pixijs-kit.md`.
