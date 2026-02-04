# Validation and CI

## Goal
Keep the repo stable as multiple people edit JSON and catalogs.

## Required validations
- Validate all JSON under `data/` against `schemas/`
- Validate export manifests (Pixi kit)
- Optionally enforce formatting (prettier) later

## Where to run
- Locally (pre-commit / pre-push)
- In CI on PRs (recommended)

## Local command
- `npm run validate:data`
  - Loads all schemas from `schemas/`
  - Validates JSON DB files under `data/` (skips most artifact JSON under `files/` except Pixi kit manifests)
  - Also validates `config/local.example.json` and `config/local.json` (if present) against `schemas/local-config.schema.json`

## CI
GitHub Actions runs:
- `npm run validate:data`
- `npm run typecheck`

Workflow:
- `.github/workflows/ci.yml`
