# Migration steps

Each file in this folder exports:
- `id`: string
- `description`: string
- `run(ctx)`: async function

The runner provides:
- `ctx.dataRoot`
- `ctx.dryRun`
- `ctx.readJson(filePath)`
- `ctx.writeJson(filePath, value)`
- `ctx.log`

Use `npm run migrate:run -- --list` to view available migrations.
