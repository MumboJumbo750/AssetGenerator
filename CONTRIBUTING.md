# Contributing

This repo is currently docs + schemas first. Code will follow the contracts defined here.

## Read first
- `docs/README.md`
- `docs/coding-guidelines.md`
- `docs/workflows/coding-workflow.md`
- `docs/decisions/README.md`
- `docs/storage/git-lfs.md`
- `docs/how-to-spec.md`
- `docs/setup/local-config.md`
- `docs/setup/scripts-hub.md`

## Rules of the road
- Treat `data/` JSON as the source of truth (Git-reviewed).
- Any schema change must update `docs/data/schemas.md` and add an ADR if it changes core behavior.
- Don’t hardcode checkpoints/LoRAs/tags in the UI; read catalogs from JSON.
- Keep large binaries in Git LFS (see `.gitattributes`).

## Adding a checkpoint (no code)
- Follow `docs/workflows/checkpoint-onboarding.md`.

## Adding tags/styles/scenarios
- Use catalogs described in `docs/data/catalogs.md`.
