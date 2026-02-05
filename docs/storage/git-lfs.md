# Git LFS policy (images)

## Goal

Keep the JSON “database” in normal Git while storing large binary assets (images/atlases) in Git LFS.

## What goes into LFS

Recommended patterns:

- `*.png`, `*.jpg`, `*.jpeg`, `*.webp`
- (optional) `*.psd`, `*.kra`, `*.aseprite`, `*.blend`

## What should NOT go into Git (default)

- model checkpoints
- LoRA weights

Store those outside the repo and reference them from JSON via `localPath` fields (see schemas).

## Onboarding

Every contributor should:

1. Install Git LFS
2. Run `git lfs install`
3. Pull LFS objects after clone: `git lfs pull`

## Onboarding check

Run:

- `npm run onboarding:check`

## Repo conventions

Binary outputs should live under:

- `data/projects/**/files/`

This keeps a clean boundary between “database JSON” and “artifact files”.
