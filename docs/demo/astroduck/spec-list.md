# SpecList: AstroDuck Space Shooter

## Project context

- Project name: AstroDuck Space Shooter
- Style: sci‑fi comic
- Scenario: invasion → space war
- Palette: bold comic colors, high contrast, neon accents

## Assets needed

### Narrative images (single images)

1. Intro story panel: office invasion (AstroDuck at desk, alarms, aliens at windows)
2. Intro story panel: AstroDuck runs to hangar (city skyline, sirens)
3. Intro story panel: ship launch (hangar doors, smoke, glow)
4. Level 1 boss intro (alien cruiser, city in background)
5. Level 2 boss intro (mars storm, alien drilling platform)
6. Level 3 boss intro (near sun, solar flare, massive alien entity)
7. Ending panel: Earth festival (celebration, fireworks, AstroDuck hero)

### Gameplay sprites (multi‑frame)

8. AstroDuck ship idle animation (loop, 6 frames)
9. AstroDuck ship bank left/right (3 frames each)
10. Player bullets (laser, plasma, spread) — 3 variants
11. Player missile trail (8 frames loop)
12. Explosion small/medium/large (8–12 frames each)

### Weapons & systems (single + multi-frame)

19. Weapon icons (HUD): laser / plasma / spread / missile / shield
20. Weapon muzzle flashes (4–6 frames each, additive feel)
21. Impact sparks (6–8 frames loop, small and large)
22. Shield bubble (idle loop, hit flash loop)
23. Thruster flame (loop)

### Enemy sprites (multi‑frame)

23. Enemy drone (idle loop, 6 frames)
24. Enemy fighter (idle loop, 6 frames)
25. Enemy tank (mars surface, 6 frames)
26. Enemy turret (idle + shoot frames)
27. Boss 1 (alien cruiser, idle + attack frames)
28. Boss 2 (mars drilling core, idle + attack frames)
29. Boss 3 (solar entity, idle + attack frames)

### Backgrounds & textures

30. Level 1 background: city skyline + space (parallax layers)
31. Level 2 background: Mars surface + alien industry silhouettes
32. Level 3 background: deep space + strong sun glow
33. Background parallax layers (separate PNGs): far stars / mid nebula / near clouds / foreground silhouettes
34. Mars floor texture (tileable)
35. Space texture with nova effects (tileable)
36. Warp transition effect (looping frames)
37. Alien industry silhouettes (tileable overlay / parallax layer)

### UI / menu

38. Title logo: “AstroDuck Space Shooter” (transparent)
39. Menu buttons: start / settings / difficulty / highscore (default + hover + pressed)
40. Difficulty selector UI (easy/normal/hard) + toggle states
41. Level select planet buttons: Earth / Mars / Sun (default + hover + locked)
42. HUD: health bar, energy bar, ammo counter frame, score frame
43. UI icons: sound on/off, music on/off, pause, back, confirm, warning, trophy
44. Pickup icons: health, energy, weapon upgrade, coin/points
45. Cursor / selection highlight (overlay)
46. UI atlas stress test: all UI icons/buttons packed into one atlas (use `docs/demo/astroduck/atlas-plan.md`)

### Achievements (demo: tracked in localStorage)

47. Achievement badge frames (bronze/silver/gold + ribbons) (transparent)
48. Achievement icons set (transparent):
    - “Office Escape” (survive intro)
    - “First Contact” (defeat first elite)
    - “Boss Breaker” (defeat any boss)
    - “Martian Miner” (defeat boss on Mars)
    - “Sun Diver” (reach Sun level)
    - “No Damage” (clear a stage without taking damage)
    - “Collector” (pickup 50 items)

### Audio (future pipeline)

29. Music: menu loop (30–60s)
30. Music: level 1 loop (60–90s)
31. Music: level 2 loop (60–90s)
32. Music: level 3 loop (60–90s)
33. SFX: laser, plasma, explosion, hit, pickup, menu click

## Global do / don’t

- Do: bold outlines, readable silhouettes, neon accents
- Don’t: photorealism, noisy textures, tiny details that vanish at gameplay scale
