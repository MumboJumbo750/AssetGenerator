# Vision and scope

## Problem statement
We want a repeatable way to create consistent game assets with AI image generation, while keeping teams aligned on:
- what needs to be created (specs),
- which models/LoRAs to use,
- how assets are tagged and organized,
- and how outputs get processed into production-ready formats (alpha, spritesheets).

## Non-goals (for initial milestones)
- Hosting large model weights in Git (checkpoints/LoRAs are referenced by metadata; weights live outside the repo).
- Building a fully multi-tenant SaaS (start with local/team repo workflows).
- Solving every DCC/export format (start with PNG + atlas JSON, then expand).

## Core principles
- **Spec-first**: prompts are derived from structured specs + catalogs.
- **Reproducible generation**: store prompts, seeds, sampler/steps, checkpoint+LoRA versions.
- **Data travels with the repo**: JSON is the source of truth; binary assets may be LFS or external.
- **Fast review**: gallery + quick tag chips + approve/reject/version.
- **Extensible catalogs**: styles/scenarios/tags are project-wide but can be overridden per checkpoint.

## Outputs
- Per-asset images (original + alpha-removed)
- Optional spritesheets/atlases (image + metadata JSON)
- Export bundles (per engine/profile)

