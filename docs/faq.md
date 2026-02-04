# FAQ

## Tagging: what do we tag, and when?
Short answer: tag early (Spec), tag truth (Variant), and tag intent (Export/Training selections).

### 1) SpecList stage (human intake)
Tagging goal: capture *requirements* and *constraints* so refinement can generate consistent AssetSpecs.
- Required: `assetType`, `style`, `scenario`, background policy (transparent vs any), tileable yes/no, animation needs (fps/frameCount).
- Optional: palette constraints, “must have / must not have”.

### 2) AssetSpec stage (structured spec)
Tagging goal: make the spec filterable and training/export-ready.
Recommended minimum tags on every spec:
- `assetType:*` (always)
- `style:*` and `scenario:*` (or rely on project defaults, but explicit tags make datasets easier)
- Usage tags (examples): `ui:menu`, `ui:hud`, `enemy:drone`, `boss:1`, `level:mars`, `vfx:impact`

Where tags live:
- `AssetSpec.tags[]` for “this asset is meant to be…”

### 3) Generation stage (asset versions + variants)
Tagging goal: separate “what we wanted” from “what we got”.
Recommended on each variant:
- Quality tags: `quality:high|medium|low`
- Fix-needed tags: `issue:cutout_bad`, `issue:blurry`, `issue:style_drift`, `issue:wrong_silhouette`
- Keepers: set `variants[].status=selected` and set `primaryVariantId` when approved

Where tags live:
- `asset.versions[].variants[].tags[]` for “this output actually looks like…”

### 4) Background removal stage
Tagging goal: reproducibility + traceability.
- Store background removal parameters under `variant.processing.bg_remove`
- Set/maintain `variant.alphaPath`

### 5) Atlas packing stage
Tagging goal: assembly metadata, not semantics.
- Keep semantic tags on the underlying assets/variants
- Atlas records store frame mapping + pack settings

### 6) Export stage
Tagging goal: stable runtime names and compatibility.
- Exports should choose `primaryVariantId` first, then selected, then fallback rules.
- Export profiles control naming/scale/padding; runtime manifests should reference IDs for traceability.

## LoRA: what should we tag for training?
Think of training tags as **captions/tokens**.

Minimum recommended training tags:
- `assetType:*` (so you can build dataset slices)
- `style:*` and `scenario:*` (so eval prompts stay stable across runs)
- Concept tags you want the LoRA to learn (examples): `character:astroduck`, `faction:aliens`, `ui:button`, `vfx:explosion`

Avoid:
- overly subjective tags (`cool`, `awesome`) unless they are consistent and meaningful
- “issue tags” in training captions (don’t train on bad outputs)

## Baseline LoRA vs project LoRA: does the “general baseline” idea make sense?
Yes.

Recommended LoRA strategy:
1) **Baseline LoRAs** (`scope: baseline`): generic, reusable improvements for asset categories:
   - UI icons, spritesheets, VFX, textures, logos
2) **Project LoRAs** (`scope: project`): project-specific characters, factions, signature look

This matches our selection policy concept (baseline first, then project) and keeps the “base quality” high.

## Are “noob-friendly” LoRA training wizards planned?
Planned (recommended). The goal is to make training safe and repeatable without deep ML knowledge.

### Wizard outline (baseline training)
1) Pick target checkpoint
2) Pick assetTypes (UI/VFX/spritesheets/textures)
3) Pick dataset filter (approved only + required tags)
4) Caption strategy (tags-only vs tags+promptTokens, plus optional fixed prefix/suffix)
5) Training preset (resolution/rank/lr/steps) with “simple” defaults
6) Run training (creates a new LoRA `release` as `candidate`)
7) Auto-eval grid (fixed prompts) + human review
8) Approve + set `activeReleaseId` (optional “recommended”)

### Wizard outline (project training)
Same as above, plus:
- choose project concept tags (e.g. `character:astroduck`)
- optional “style lock” to avoid drifting away from the project art direction

See also:
- Tagging workflow: `docs/workflows/tagging.md`
- LoRA workflow: `docs/workflows/lora-training.md`
