# ID governance (stable IDs + rename rules)

This repo is **data-first**: JSON files under `data/` are the database. That only works long-term if IDs are stable and rename rules are explicit.

## Two kinds of IDs

### 1) Machine IDs (generated, opaque)
Use these for records that are created frequently and aren’t meant to be typed by humans:
- `job.id`, `specList.id`, `spec.id`, `asset.id`, `asset.versions[].id`, `asset.versions[].variants[].id`
- `atlas.id`, `export.id`, `dataset.id`

Rule:
- Use **ULID** (what the backend/worker already generates).
- Filenames should match the ID: `<id>.json`.
- Never change these IDs after creation.

### 2) Human IDs (curated, stable slugs)
Use these for curated lists where humans reference the ID in specs/policies:
- `project.id`
- catalog entries: `assetType.id`, `style.id`, `scenario.id`, `palette.id`
- `checkpoint.id`
- `lora.id`, `lora.releases[].id`
- tags: `tagGroup.id` and `tag.id`

Rule:
- IDs are **lowercase** and should be stable.
- Prefer **underscore** style (`ui_icon`, `pixel_art`, `ckpt_sd15_demo`).
- Keep IDs short and readable; put detail in `name` / `label`.

Allowed characters (recommended):
- `a-z`, `0-9`, `_`, `-`
- Tags also commonly use `:` for namespacing (`assetType:ui_icon`, `level:mars`).

## Tags: recommended convention

We recommend namespaced tag IDs:
- `groupId:value`

Examples:
- `assetType:ui_icon`
- `quality:blurred`
- `level:mars`

Why:
- Tags stay unique even if multiple groups have similar “value” names.
- They’re easy to filter/search and easy to migrate.

## What “rename” means

Most of the time you should **rename the display label**, not the ID:
- Change `label` / `name` freely.
- Keep `id` stable.

Only rename an ID when it’s truly wrong (typo, bad taxonomy, merging concepts).

## Safe ID renames (migration rule)

If you rename a curated ID, you must update **all references** across the JSON DB (specs, assets, policies, catalogs, etc.), and rename the filename where the filename is keyed by ID.

Use:
- `npm run migrate:rename-id -- --kind <kind> --from <oldId> --to <newId> [--project <projectId>] [--dry-run]`

Supported kinds:
- `tag`
- `tagGroup` (also rewrites `oldGroup:*` tag IDs)
- `assetType`
- `style`
- `scenario`
- `palette`
- `checkpoint`
- `lora`

Notes:
- Jobs and runtime logs are treated as ephemeral; the migrator prioritizes project/spec/asset/catalog consistency.

## Schema evolution migrations

For non-trivial schema changes or backfills, use the migration runner:
- `npm run migrate:list`
- `npm run migrate:run -- --id <migrationId>`
- `npm run migrate:run -- --all`
- `--dry-run` is supported on all migrations.

Migration steps live in `scripts/migrate/steps/` and are applied to `data/` files.
