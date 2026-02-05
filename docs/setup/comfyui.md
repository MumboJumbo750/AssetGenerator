# ComfyUI setup (repo-local)

## Goal

Install and run ComfyUI in a way that:

- keeps Python dependencies isolated inside this repo
- makes scripts always use the same interpreter
- avoids mixing global Python installs

## Requirements

- Git installed (`git` in PATH)
- Python 3.10+ installed (recommended 3.11)
  - On Windows, the `py` launcher is recommended

## Setup

1. Create local config (optional but recommended):
   - Copy `config/local.example.json` to `config/local.json`
   - Set `comfyui.baseUrl` to your preferred host/port
2. Run:
   - `npm run comfyui:setup`
3. (Optional) Install required custom nodes:
   - `npm run comfyui:nodes`

## Model setup guides

- Copax TimeLess (SDXL): see [docs/setup/copax.md](copax.md)
- Pony Diffusion V6 XL: see [docs/setup/pony-diffusion-v6-xl.md](pony-diffusion-v6-xl.md)
- Juggernaut XL: see [docs/setup/juggernaut-xl.md](juggernaut-xl.md)
- SD XL (base): see [docs/setup/sd-xl.md](sd-xl.md)

This will:

- clone ComfyUI into `tools/comfyui/ComfyUI/` (ignored by git)
- create a venv in `tools/comfyui/.venv/` (ignored by git)
- install Python deps into that venv

## Start

- `npm run comfyui:start`
  - If the port is already in use and you want to force a restart: `npm run comfyui:start -- --kill`

## Stop / restart

- `npm run comfyui:stop`
- `npm run comfyui:restart`

## Troubleshooting

- If Python cannot be found, set `ASSETGEN_PYTHON` to a Python executable path and rerun setup.
- If you change `comfyui.baseUrl`, restart ComfyUI.
- If the port is stuck in use, run `npm run ports:status -- --port 8188` and `npm run ports:kill -- --port 8188`.
