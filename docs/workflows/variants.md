# Variant and version management (assets + LoRAs)

## Why this matters
Variant/version control is how we keep quality high without losing reproducibility.

## Assets
We use two levels:
- **Asset version**: a regeneration run (new prompt/settings/checkpoint/LoRAs). Stored in `asset.versions[]`.
- **Variant**: multiple outputs from the same version/run. Stored in `asset.versions[].variants[]`.

Recommended rules:
- Set `primaryVariantId` when approving a version.
- Use `variants[].status`:
  - `candidate`: default after generation
  - `selected`: contenders/keepers (may be multiple)
  - `rejected`: never use for export/training

Downstream consumers:
- Export defaults to `primaryVariantId` when present, else the highest-rated `selected`, else the highest-rated `candidate`.
- LoRA dataset builder defaults to `approved` asset versions and uses the same selection logic.

## LoRAs
We treat LoRA “variants” as **releases**:
- LoRA `id` is stable (conceptual model)
- `releases[]` are individual trained artifacts (runs)
- `activeReleaseId` picks the default artifact

Recommended rules:
- `candidate`: new training run, not yet trusted
- `approved`: passes eval + QC and can be recommended
- `deprecated`: kept for reproducibility only

Promotion workflow:
1) Train -> create a new `release` (`candidate`)
2) Run eval grid -> attach evaluation artifacts/notes
3) Approve -> set `status=approved`, update `activeReleaseId`
