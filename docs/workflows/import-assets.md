# Workflow: import existing assets

## Goal

Bring externally-created assets (hand-drawn, purchased packs, legacy files) into the same JSON DB so they can be:

- tagged and reviewed
- used in exports
- included in LoRA datasets (when allowed)

## Inputs

- A folder of images/atlases
- Optional metadata (names, tags, license info)
- Target projectId

## Steps

1. Create an import record (job or wizard)
2. Copy/link files into `data/projects/<projectId>/files/...`
3. Create/attach `asset.json` records
   - create versions/variants with `status=approved` if already production-ready
4. Tag using the same catalog chips
5. (Optional) Create atlases or connect existing atlas metadata

## Notes

- Licensing/source metadata should be preserved (future: add explicit license fields).
- Imported assets should not be assumed safe for training by default.
