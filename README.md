# AssetGenerator

Game asset creator with:
- A frontend for projects, specs, galleries, tagging, and admin
- A backend API + job system for generation and post-processing
- An image pipeline (generation -> review/tag -> alpha removal -> spritesheet stitching -> export)
- Checkpoint + LoRA management (per asset type, per checkpoint training, multiple checkpoints)

Start here:
- `docs/README.md`
- `docs/workflows/asset-creation.md`
- `docs/data/README.md`
- `docs/how-to-spec.md`

Team setup:
- Images are expected to be stored with Git LFS: `docs/storage/git-lfs.md`

Tooling:
- Script hub: `package.json` (`npm run help`)
- ComfyUI (repo-local venv): `docs/setup/comfyui.md`

## Run (dev)
1) Install deps:
   - `npm install`
2) Seed demo data (recommended):
   - `npm run seed` (use `npm run seed -- --force` to overwrite)
2) (Optional) Configure local settings:
   - copy `config/local.example.json` -> `config/local.json`
3) Start the app:
   - `npm run dev`

Backend defaults to `http://127.0.0.1:3030` and serves `data/` at `/data/*`.
Frontend defaults to `http://127.0.0.1:5173` (Vite).

If you see `EADDRINUSE` (port already in use), free the default ports then retry:
- `npm run ports:kill -- --ports 3030,5173`
