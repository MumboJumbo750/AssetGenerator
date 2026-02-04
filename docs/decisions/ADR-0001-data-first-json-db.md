# ADR-0001: Data-first JSON “database”

Date: 2026-02-03

## Status
Accepted

## Context
We want teams to collaborate on asset specs, tags, and metadata through Git, and to be able to move the entire app and its project state by cloning a repository.

We also want:
- human-reviewable diffs (PRs for catalogs/specs)
- reproducible generation (prompts/settings stored)
- minimal external infrastructure at the start

## Decision
Use Git-versioned JSON files under `data/` as the source of truth for:
- projects, catalogs, specs, assets, jobs

The backend and frontend must treat these JSON files as authoritative and validate writes against JSON schemas in `schemas/`.

Model weights (checkpoints/LoRAs) are referenced by metadata but stored outside Git by default.

## Consequences
- Simple collaboration and audit trail via Git history.
- Requires careful ID and schema discipline to avoid merge conflicts.
- Large binaries need a separate policy (Git LFS or external storage).

