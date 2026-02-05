# Atlas plan (4-atlas stress test)

This plan is meant to produce **four** atlases so we can test:

- bg removal (alpha)
- atlas packing (stitching)
- Pixi preview
- Pixi kit export (images + atlases)

Important note (today): our generator is `txt2img`, so “animations” are simulated by generating **N variants** and treating them as frames for packing.

## Atlas A: player

Include frames from:

- `spec_astroduck_player_ship` (ship variants as frames)
- `spec_astroduck_player_thruster_vfx`
- `spec_astroduck_player_shield_bubble`
- Optional single sprites to pack as well:
  - `spec_astroduck_pickups`

Suggested `atlasId`: `atlas_player`

## Atlas B: enemies

Include frames from:

- `spec_astroduck_enemy_drone`
- `spec_astroduck_enemy_fighter`
- `spec_astroduck_enemy_turret`
- `spec_astroduck_boss1_cruiser`
- `spec_astroduck_boss2_drilling_core`
- `spec_astroduck_boss3_solar_entity`

Suggested `atlasId`: `atlas_enemies`

## Atlas C: VFX

Include frames from:

- `spec_astroduck_weapon_projectiles`
- `spec_astroduck_weapon_muzzle_flashes`
- `spec_astroduck_explosions_vfx`
- `spec_astroduck_impact_sparks`
- `spec_astroduck_warp_effect`

Suggested `atlasId`: `atlas_vfx`

## Atlas D: UI

Include frames from:

- `spec_astroduck_menu_buttons` (default/hover/pressed)
- `spec_astroduck_level_select_planets` (default/hover/locked)
- `spec_astroduck_hud_icons`
- `spec_astroduck_difficulty_selector`
- Achievements:
  - `spec_astroduck_achievement_badge_frames`
  - `spec_astroduck_achievement_icons`

Suggested `atlasId`: `atlas_ui`

## Packing checklist (manual for now)

1. Generate each AssetSpec (queue `generate` jobs).
2. Run `bg_remove` jobs for each chosen output (alpha PNGs).
3. Build an `atlas_pack` job per atlas with `input.framePaths[]` pointing at the alpha PNGs.
4. Run an `export` job with `atlasIds` = `atlas_player`, `atlas_enemies`, `atlas_vfx`, `atlas_ui`.

## One-command queue helper (implemented)

If you already generated assets and have `alphaPath` populated for the variants you want to pack:

```sh
npm run demo:astroduck:queue-atlases -- --project <projectId>
```

Options:

- `--allow-original` (fallback to `originalPath` when no `alphaPath` exists)
- `--padding 2`
- `--export-id <id>`
- `--dry-run`

Machine-readable plan used by the script:

- `docs/demo/astroduck/atlas-plan.json`

## Example job bodies (API)

These are **examples**. Real `assetId` / image paths come from generated assets.

### Pack atlas

`POST /api/projects/<projectId>/jobs`

```json
{
  "type": "atlas_pack",
  "input": {
    "atlasId": "atlas_ui",
    "padding": 2,
    "framePaths": [
      { "key": "btn_start_default", "path": "projects/<projectId>/files/images/<assetId>/alpha/<variantId>.png" }
    ]
  }
}
```

### Export Pixi kit

`POST /api/projects/<projectId>/jobs`

```json
{
  "type": "export",
  "input": {
    "exportId": "export_astroduck_demo_01",
    "assetIds": [],
    "atlasIds": ["atlas_player", "atlas_enemies", "atlas_vfx", "atlas_ui"],
    "animations": [],
    "ui": []
  }
}
```
