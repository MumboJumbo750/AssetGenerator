# Workflow: asset administration

## Purpose
Keep the repository clean and assets reliable over time:
- version assets without losing history
- manage deprecations
- keep tags/catalogs consistent

## Recommended rules
- Never delete assets/specs outright; mark them:
  - `status: deprecated` with reason
- Any regeneration creates a new **asset version** linked to the same spec.
- Keep a “primary” variant per asset/version for downstream use.

See `docs/workflows/variants.md`.

## Curation
- Approved assets become part of:
  - LoRA training datasets
  - export manifests
- Rejected assets stay for reference but are excluded from training/exports by default.

## Catalog governance
- Tag changes can affect filtering, datasets, and LoRA training.
- Prefer adding new tags over renaming existing tags.
- If renaming is needed, perform a migration step (script later).
