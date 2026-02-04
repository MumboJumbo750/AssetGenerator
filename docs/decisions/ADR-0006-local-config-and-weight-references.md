# ADR-0006: Local config + weight references (avoid committing absolute paths)

Date: 2026-02-03

## Status
Accepted

## Context
Checkpoints and LoRA weights are large binaries and are not committed to Git by default.
If we store absolute `localPath` values in versioned JSON, teams will constantly conflict because each machine has different directories.

We still need the app to locate model files reliably on each contributor’s machine.

## Decision
1) Introduce a non-versioned local config file:
   - `config/local.json` (ignored by Git)
   - schema: `schemas/local-config.schema.json`

2) Reference weights in shared JSON via a small indirection:
   - `weights.kind = config_relative` with `weights.base` + `weights.path`
   - (or `repo_relative` for a shared repo-local models folder)
   - keep `localPath` only as a deprecated fallback

Docs:
- `docs/setup/local-config.md`

## Consequences
- Shared JSON stays stable across machines.
- Onboarding requires creating `config/local.json`.
- The runtime must implement resolution rules for `weights.*`.

