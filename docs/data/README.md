# Data storage (Git-friendly “database”)

## Goals
- Versioned, mergeable data
- No hidden state; the repo is the project
- Works offline and can be moved between machines

## Directory layout (proposed)
```
data/
  shared/
    loras/
      <loraId>.json
    datasets/
      <datasetId>.json
  projects/
    <projectId>/
      project.json
      catalogs/
        asset-types.json
        styles.json
        scenarios.json
        tags.json
        palettes.json
      checkpoints/
        <checkpointId>.json
      loras/
        <loraId>.json
      spec-lists/
        <specListId>.json
      specs/
        <specId>.json
      assets/
        <assetId>.json
      atlases/
        <atlasId>.json
      datasets/
        <datasetId>.json
      export-profiles/
        <profileId>.json
      exports/
        <exportId>.json
      jobs/
        <jobId>.json
      files/
        images/
          <assetId>/
            original/
            alpha/
            previews/
        atlases/
          <atlasId>/
            atlas.png
            atlas.json
        exports/
          <exportId>/
            pixi-kit/
```

## IDs and filenames
- Use **stable IDs** (e.g., ULID/UUID) and store them inside each JSON file.
- Filenames should match the ID to avoid rename churn.
- Never rely on “title” as a unique key.

See also:
- `docs/data/id-governance.md` (curated IDs, tag conventions, safe renames)

## Data ownership rules
- `project.json` holds defaults and policies (style/scenario defaults, tag defaults, LoRA selection policy).
- Catalog JSONs define selectable lists and tag groups.
- Specs are immutable-ish: prefer versioning fields rather than rewriting history.
- Assets reference specs and store generated variants and processing outputs.
- `data/shared/loras/*.json` holds **baseline** LoRA metadata reusable across projects.

## Large files policy
Recommended:
- Store only metadata + small thumbnails in Git by default.
- Use Git LFS for large PNG sets if the team wants shared binaries.
- Never store model checkpoints/LoRA weights in Git by default; reference them.

## Validation
All JSON under `data/` should validate against schemas described in:
- `docs/data/schemas.md`
