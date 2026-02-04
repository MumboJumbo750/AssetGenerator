# Workflow: Import existing assets

## Goal
Ingest existing image files into the data-first DB so they can be tagged, reviewed, and used for training.

## Quick start
1) Start the backend (`npm run backend:dev`)
2) Run the import script:
   - `npm run import:assets -- --project <projectId> --dir <folder>`

## Options
- `--asset-type <type>` (default: `ui_icon`)
- `--status <draft|review|approved>` (default: `review`)
- `--tag <tag>` (repeatable)
- `--source <text>` `--author <text>` `--license <text>` `--url <url>` `--notes <text>`
- `--endpoint <url>` (default: `http://127.0.0.1:3030`)
- `--dry-run` to preview

## What it does
- Creates one AssetSpec per file
- Copies the image into `data/projects/<projectId>/files/images/<assetId>/original/`
- Creates an Asset with a single version + variant

## Troubleshooting
- Check `import-errors.json` if the script reports failures.
