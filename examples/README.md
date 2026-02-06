# Example Projects

This directory contains **committed example data** that the seed script copies into `data/` at bootstrap time.

## Usage

```bash
npm run seed            # copies examples/astroduck_demo → data/projects/astroduck_demo
npm run seed -- --force # overwrites existing data
npm run seed -- --dry-run
```

## Structure

```
examples/
  astroduck_demo/           # Full demo project: AstroDuck Space Shooter
    project.json            # Project manifest + checkpoint policies
    baseline-profile.json   # Baseline validation profile
    automation-rules/       # Automation rules (atlas pack on approval)
    catalogs/               # Asset types, styles, scenarios, palettes, tags
    checkpoint-profiles/    # Checkpoint prompt dialect profiles (copax, pony)
    checkpoints/            # Checkpoint records (sd15, copax, pony)
    loras/                  # Project-scoped LoRA records
    spec-lists/             # Spec list wrappers
    specs/                  # 25 asset specifications
  shared/
    loras/                  # Baseline-scoped LoRA records
```

## Notes

- `data/` is gitignored — all runtime data stays local.
- To create a fresh project from scratch, copy and modify `astroduck_demo/` as a template.
- The seed script creates empty runtime directories (`assets/`, `jobs/`, `files/`) automatically.
