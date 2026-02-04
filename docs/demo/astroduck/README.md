# AstroDuck Space Shooter (Pixi demo project)

This is a small **demo project** used to test the asset generator end‑to‑end.
It is designed to exercise **spec refinement, generation, tagging, bg removal, spritesheets, and export kits**.

## Narrative summary
- Genre: horizontal shooter
- Style: sci‑fi comic
- Premise: AstroDuck is an office worker when aliens invade; he jumps into his flight vehicle and fights through 3 levels.

## Levels
1) **Earth** (office invasion → city space)
   - Intro story images
   - Level background (city + sky)
   - End‑boss intro image
2) **Mars**
   - Mars surface floor texture
   - Mars sky/space texture + nova effects
   - Alien industry silhouettes in background
   - End‑boss intro image
3) **Sun**
   - Deep space background with a strong sun
   - Warp effect transition into level
   - Final boss intro image

After final boss: **festival Earth** ending narrative image.

## Menu & UI
- Title: “AstroDuck Space Shooter”
- Buttons: Start / Difficulty / Highscore / Settings
- Level selector with 3 planet buttons (Earth, Mars, Sun) + hover states
- UI icons (sound/music, back, confirm, pause)

## Pipeline coverage checklist (what this demo should exercise)
- Transparent sprites + background removal: player ship, enemies, VFX
- Spritesheets/atlases: ship idle, explosions, warp, muzzle flashes
- Tileable textures: Mars floor, space nova texture
- UI states: buttons (default/hover/pressed), level select planets (default/hover/locked)
- Export kit: bundle images + atlases into a Pixi kit and preview it in the frontend
- Variants: multiple weapon styles / enemy skins for tagging + selection workflows
- Logging: force a failure (missing checkpoint) and verify job + system logs show it

## File references
- SpecList (human input): `docs/demo/astroduck/spec-list.md`
- SpecList JSON (example shape): `docs/demo/astroduck/spec-list.json`
- AssetSpec JSON samples: `docs/demo/astroduck/specs/*.json`
- Atlas plan (4-atlas stress test): `docs/demo/astroduck/atlas-plan.md`

## Notes on audio
We **can** generate audio, but the current pipeline is image‑focused.
For now, audio is included in the SpecList so we can add a future audio adapter
(`job.type=audio_generate`) and test end‑to‑end flows with placeholder files.
