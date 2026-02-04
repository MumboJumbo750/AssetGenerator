# ADR-0004: LoRA scopes + variant releases

Date: 2026-02-03

## Status
Accepted

## Context
We want a “base quality” uplift for common asset types (UI, textures, spritesheets, overlays) that is reusable across projects, while also supporting project-specific LoRAs (world/lore/style specifics).

We also need a clean way to:
- iterate training runs,
- compare candidates,
- promote one version as “active”,
- and keep old versions for reproducibility.

## Decision
Introduce two LoRA scopes:
- **baseline**: general-purpose LoRAs intended to improve asset-type quality across projects.
- **project**: LoRAs trained for a specific project’s content/style.

Represent LoRA “variants” as **releases**:
- a LoRA has a stable `id`
- each training run creates a new `release` with its own artifact reference and evaluation metadata
- one `activeReleaseId` is promoted for default use

Selection rule (initial):
- UI shows baseline + project LoRAs compatible with the selected `checkpointId` and `assetType`.
- Defaults prioritize baseline first, then project additions (configurable later per project).

Storage rule (initial, repo-friendly):
- Baseline and project LoRA **metadata** are still JSON and versioned in Git.
- LoRA **weight files** remain outside Git by default and are referenced by `localPath` on the release.

## Consequences
- Improves quality early without locking everything to a single project.
- Supports safe iteration: candidates can be compared and only promoted when they pass QC.
- Requires UI/admin views for scope filtering and release promotion/deprecation.

