# UI Redesign Plan — "Pipeline Studio"

> **Goal:** Transform the current 13-page tool-centric layout into a streamlined,
> pipeline-first experience where the user **sees their images flowing through stages**
> and rarely has to think about which page to visit.

---

## Part 1 — Diagnosis: What's Wrong Today

### 1.1 Too many pages, not enough pipeline

The current navigation has **13 top-level entries**:
Overview · Specs · Review · Jobs · Assets · Atlases · Exports · Training · Automation · Admin · Pixi · Help · Logs.

Each page is a standalone island. The user must mentally map the pipeline
(Spec → Generate → Review → Alpha → Atlas → Export) across separate pages,
context-switching constantly. Nothing shows "where am I in the pipeline for this asset?"

### 1.2 Automation exists but feels manual

Despite having an automation engine in the backend, the UI still requires the user to:

- Manually navigate to Specs → click "Queue generate" per spec
- Navigate to Assets → approve variants one by one
- Navigate to Atlases → manually add frames → build
- Navigate to Exports → select assets/atlases → map animations → run

Every transition is a page hop + manual re-selection.

### 1.3 Visual monotony

Every panel is `Card withBorder radius="md" p="md"`. There's no visual hierarchy
between a primary workspace (the image you're reviewing) and a secondary control
(padding slider). Everything has the same visual weight, making it hard to focus.

### 1.4 God-file pages

`TrainingPage` (766 lines), `AssetReviewPanel` (501 lines), `AutomationPage` (493 lines),
`SpecsPage` (471 lines) — these violate the project's own "no god files" rule.

### 1.5 JSON editing in production UI

Admin, Automation rules, and chained jobs all use raw `<Textarea>` for JSON.
This is an API console, not a user interface.

---

## Part 2 — Redesign Principles

| #   | Principle                  | Meaning                                                                                                                     |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Pipeline-first**         | The primary view should show the user's content flowing through stages, not tools organized by developer concepts           |
| 2   | **See the images**         | Images are the product. Thumbnails, grids, and previews should dominate — controls should be secondary                      |
| 3   | **Automate the boring**    | Every multi-step handoff that follows a predictable pattern should happen automatically with a single opt-in                |
| 4   | **Progressive disclosure** | Show the minimum needed, reveal detail on demand — no 500-line everything-at-once panels                                    |
| 5   | **Context stays**          | When reviewing an asset, everything relevant (spec, generation params, variants, status) is visible without navigating away |
| 6   | **One primary action**     | Every screen state should have exactly one obvious "next thing to do"                                                       |
| 7   | **Binary decisions first** | Quality gates should default to one unambiguous yes/no question before exposing advanced controls                           |
| 8   | **Keep the cyberpunk**     | The dark theme + neon accents are distinctive - refine it, don't replace it                                                 |
| 9   | **Exceptions-only UX**     | Users should only be interrupted when confidence is low or a hard rule fails; everything else runs silently                 |
| 10  | **No-tune default**        | Advanced generation knobs stay hidden unless Expert mode is explicitly enabled                                              |

---

## Part 3 — New Information Architecture

### 3.1 Navigation: from 13 pages → 5 zones

```
┌──────────────────────────────────────┐
│  ◆ AssetGenerator    [Project ▼]     │ ← Header (stays)
├──────────┬───────────────────────────┤
│          │                           │
│ PIPELINE │  ← Main workspace         │
│ Dashboard│                           │
│ Review   │                           │
│ Library  │                           │
│ Export   │                           │
│ ──────── │                           │
│ Settings │                           │
│          │                           │
└──────────┴───────────────────────────┘
```

| Zone          | Replaces                         | Purpose                                                                                                                                                   |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pipeline**  | Overview + Specs + Jobs          | The flow. A visual board showing **all specs and their stage** (draft → generating → review → alpha → atlas → exported). One-click actions at each stage. |
| **Dashboard** | Overview metrics                 | Quick health: counts, running jobs, system status, recent activity feed                                                                                   |
| **Review**    | Review + Assets (review mode)    | Focused image review. Full-screen image + fast keyboard-driven approve/reject/tag. Nothing else.                                                          |
| **Library**   | Assets + Atlases + Training      | Everything that's been produced. Grid/list browse with faceted filtering. Drill into any asset to see its full history.                                   |
| **Export**    | Exports + Pixi                   | Configure and run exports. Live preview embedded.                                                                                                         |
| **Settings**  | Admin + Automation + Logs + Help | Configuration, rules, diagnostics — power-user territory, kept out of the primary flow                                                                    |

This collapses 13 nav items into **5 primary + 1 secondary**, cutting cognitive load by ~60%.

### 3.2 Pipeline View — the centerpiece

This is the most important new concept. It's a **Kanban-style board** where each
column is a pipeline stage:

```
╔════════════╦════════════╦════════════╦════════════╦════════════╦════════════╗
║  DRAFT     ║ GENERATING ║  REVIEW    ║  ALPHA     ║  ATLAS     ║ EXPORTED   ║
╠════════════╬════════════╬════════════╬════════════╬════════════╬════════════╣
║ ┌────────┐ ║ ┌────────┐ ║ ┌────────┐ ║ ┌────────┐ ║ ┌────────┐ ║            ║
║ │ spec   │ ║ │ spec   │ ║ │thumb   │ ║ │thumb   │ ║ │atlas   │ ║            ║
║ │ title  │ ║ │ ██████ │ ║ │ [img]  │ ║ │ [img]  │ ║ │ [grid] │ ║  ┌──────┐  ║
║ │ type   │ ║ │ 63%    │ ║ │ 4 vars │ ║ │ ✓ done │ ║ │ 8 frm  │ ║  │ kit  │  ║
║ │        │ ║ │        │ ║ │        │ ║ │        │ ║ │        │ ║  │ .zip  │  ║
║ │[Gener.]│ ║ │        │ ║ │[Review]│ ║ │        │ ║ │[Export]│ ║  │  ✓    │  ║
║ └────────┘ ║ └────────┘ ║ └────────┘ ║ └────────┘ ║ └────────┘ ║  └──────┘  ║
║ ┌────────┐ ║            ║ ┌────────┐ ║            ║            ║            ║
║ │ spec   │ ║            ║ │thumb   │ ║            ║            ║            ║
║ │ ...    │ ║            ║ │ ...    │ ║            ║            ║            ║
║ └────────┘ ║            ║ └────────┘ ║            ║            ║            ║
╚════════════╩════════════╩════════════╩════════════╩════════════╩════════════╝
```

**Why this works:**

- User sees **everything at once** — no page-hopping to understand progress
- Each card shows a **thumbnail** (real image!) as soon as generation completes
- Each card has exactly **one primary action** button for its current stage
- Cards move left-to-right automatically as pipeline stages complete
- Column counts give instant health metrics ("12 in review, 3 generating")

**Card behaviors by stage:**

| Stage      | Card shows                | Primary action                     | Auto-advance trigger                           |
| ---------- | ------------------------- | ---------------------------------- | ---------------------------------------------- |
| Draft      | Spec title + type + tags  | **Generate** (opens param popover) | —                                              |
| Generating | Progress bar + ETA        | Cancel                             | Job completes → Review                         |
| Review     | Thumbnail grid (variants) | **Approve** (opens review modal)   | Version approved                               |
| Alpha      | Thumbnail (alpha preview) | — (auto bg-remove)                 | bg_remove job completes → Atlas (if animation) |
| Atlas      | Atlas preview thumbnail   | — (auto-packed)                    | `auto_atlas_pack` rule fires → Exported        |
| Exported   | Kit badge + download      | **Download**                       | —                                              |

### 3.3 Review Mode — immersive, keyboard-driven

When the user clicks "Review" on a pipeline card (or opens the Review zone):

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Pipeline          "Laser turret v2"    3 / 12   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌──────────────────┐                     │
│                    │                  │                     │
│                    │                  │                     │
│                    │    [LARGE IMG]   │  ← 70% of viewport  │
│                    │                  │                     │
│                    │                  │                     │
│                    └──────────────────┘                     │
│                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                          │
│  │var 1│ │var 2│ │var 3│ │var 4│   ← variant strip          │
│  └─────┘ └─────┘ └─────┘ └─────┘                          │
│                                                             │
│  Tags: [pixel-art] [character] [+]     ★★★★☆               │
│                                                             │
│  [← Prev]  [ ✗ Reject ]  [ ✓ Approve + Next ]  [Next →]   │
│                                                             │
│  Keyboard:  ←/→ navigate   A approve   R reject   1-5 rate │
└─────────────────────────────────────────────────────────────┘
```

**Key improvements:**

- **Image dominates** — 70%+ of viewport is the image, not controls
- **Keyboard shortcuts** — A/R/1-5/arrows for zero-mouse reviewing
- **Auto-advance** — approving moves to next asset automatically
- **Variant strip** — click to compare, no dropdown menus
- **Contextual tags** — chip bar right below the image, toggle with click
- **Counter** — "3 / 12" shows progress through the review queue

### 3.4 Library View — visual grid with facets

Replaces the current list-heavy Assets page with a **Pinterest/Figma-style grid**:

```
┌─────────────────────────────────────────────────────────────┐
│  Library                                                    │
│  [🔍 Search...] [Type ▼] [Tags ▼] [Status ▼] [Stage ▼]    │
│  ┌──────────────┐                                           │
│  │ Tabs: Assets │ Atlases │ LoRAs │ Exports │               │
│  └──────────────┘                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │      │ │      │ │      │ │      │ │      │ │      │   │
│  │[img] │ │[img] │ │[img] │ │[img] │ │[img] │ │[img] │   │
│  │      │ │      │ │      │ │      │ │      │ │      │   │
│  │name  │ │name  │ │name  │ │name  │ │name  │ │name  │   │
│  │●appr │ │○revw │ │●appr │ │●appr │ │○revw │ │●appr │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │      │ │      │ │      │ │      │ │      │            │
│  │[img] │ │[img] │ │[img] │ │[img] │ │[img] │            │
│  │...   │ │...   │ │...   │ │...   │ │...   │            │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            │
│                                                             │
│        ────────── Load more (24 of 142) ──────────         │
└─────────────────────────────────────────────────────────────┘
```

**Key improvements:**

- **Thumbnail grid** — see 12-24 assets at once instead of a 520px scrollable list
- **Faceted filters** — dropdowns for type/tags/status/stage, all combinable
- **Tabs** — Assets, Atlases, LoRAs, Exports in one place (no separate pages)
- **Click to drill** — opens a detail drawer/modal with full history, variants, and metadata
- **Bulk select** — checkbox overlay on hover, select → bulk actions toolbar appears
- **Infinite scroll or pagination** — no more `.slice(0, 12)`

### 3.5 Decision Sprint Mode (yes/no gameplay)

For review-heavy projects, add a dedicated **Decision Sprint** mode that behaves like a rapid binary game:

- Show one asset at a time, one question at a time, with only **Yes / No / Skip / Undo**
- Keep keyboard-first controls: `Y` = yes, `N` = no, `S` = skip, `U` = undo
- Ask only the highest-impact question for the current stage first
- Auto-advance immediately after each answer

Example flow:

```
Question 1: "Do you see a dog?"
  Yes -> tag subject:dog -> keep in candidate set
  No  -> tag subject:missing -> route to regenerate preset

Question 2: "Is silhouette clean?"
  Yes -> mark qa:silhouette_ok
  No  -> mark qa:silhouette_bad -> route to alpha fix or reject

Question 3: "Ready to approve?"
  Yes -> approve + next stage
  No  -> reject + next candidate
```

This gives beginners a game-like loop while still producing structured review metadata.

### 3.6 Default user journey (3 actions only)

For a normal production user, the primary loop should collapse to:

1. Start pipeline (`Run Pipeline` on spec list or batch)
2. Play Decision Sprint (yes/no/skip only for uncertain items)
3. Export approved bundle

Everything else (prompt composition, LoRA resolution, validator routing, retries, rule firing) should happen in the background and appear only as status chips, not forms.

---

## Part 4 — Automation & Smart Defaults

### 4.1 One-Click Pipeline

Instead of manually navigating to each page, offer a **"Run Pipeline"** action on any spec:

```
User creates spec →
  [Run Pipeline] button →
    ✓ Generate (4 variants, checkpoint auto-selected from spec)
    ✓ Auto background removal (if spec says transparent_required)
    ✓ Auto atlas pack (if spec is animation + all frames approved)
    ✓ Notify when ready for review
```

This chains jobs via the existing `nextJobs` + `auto_atlas_pack` automation.
The UI just needs a single button that creates the chain.

### 4.2 Smart Spec Creation

Replace the current text-heavy SpecList refinement with a **visual wizard**:

```
Step 1: What are you making?
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │  🎮      │ │  🖼️      │ │  🏃      │ │  🔤      │
  │ UI Icon  │ │ Sprite   │ │ Animation│ │  Logo    │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘

Step 2: Style & Scenario (visual picker, not text fields)
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ [sample] │ │ [sample] │ │ [sample] │
  │ Pixel    │ │ Cartoon  │ │ Realistic│
  └──────────┘ └──────────┘ └──────────┘

Step 3: Describe it
  [Positive prompt                                    ]
  [Negative prompt (pre-filled from checkpoint)       ]

Step 4: Generation settings (smart defaults, expandable)
  Checkpoint: [auto-selected based on style]
  Variants: 4    Size: 512×512
  [▸ Advanced: sampler, scheduler, CFG, seed]

→ [Create & Generate]   or   [Create as Draft]
```

### 4.3 Quick Actions Bar

A persistent floating bar at the bottom of the Pipeline view:

```
┌─────────────────────────────────────────────────────────┐
│  12 in review  │  [Approve All Selected]  [Bulk Tag]    │
│  3 generating  │  [Run Pipeline for 5 Draft Specs]      │
└─────────────────────────────────────────────────────────┘
```

This replaces the current BulkActionsPanel (which is buried inside the Assets page)
with a globally accessible action bar that shows current queue state.

### 4.4 Decision trees per asset type

Define short, stage-aware question trees instead of generic review forms.

Template:

- Trigger: stage + assetType (+ optional style/scenario)
- Questions: ordered binary checks
- Mapping: answer -> tags/status/actions
- Exit condition: approve, reject, or regenerate route selected

Example question sets:

- Character sprite: "Subject visible?" -> "Pose readable?" -> "Edge cleanup needed?" -> "Approve?"
- UI icon: "Shape recognizable?" -> "Contrast sufficient?" -> "Transparent edge clean?" -> "Approve?"
- Animation frame: "Frame continuity OK?" -> "Jitter/artifact present?" -> "Approve sequence step?"

### 4.5 Confidence routing and batch apply

Use model confidence to avoid asking unnecessary questions:

- High confidence: auto-apply answer and continue silently
- Medium confidence: ask human yes/no question
- Low confidence: ask human + suggest fallback preset

After a human answer, offer:

- "Apply this answer to similar items (N)" with one click
- "Always auto-apply for this spec + checkpoint" as an opt-in rule

This shifts review from manual per-item clicking to exception-driven supervision.

### 4.6 Baseline Profiles and quality contracts

Add a first-class baseline layer so recurring art constraints are enforced automatically, not remembered manually by reviewers.

Contract model:

- Global baseline: rules that apply to all generated assets
- Asset-type baseline: rules for textures, icons, buttons, animations, etc.
- Spec override: optional project/spec exceptions with explicit justification

Example baseline rules:

- `global.no_drop_shadows = true`
- `global.background = white_or_transparent`
- `texture.tileable_edges = required`
- `texture.lighting = flat`
- `ui_button.required_states = [default, hover, pressed, disabled]`
- `ui_button.state_alignment = exact`
- `ui_select.required_states = [default, hover, open, disabled]`
- `icon.padding_px = 8`

Automation behavior:

- Pre-generation: inject prompt and negative-prompt constraints from baseline profiles
- Post-generation: run validators (shadow check, background check, edge cleanup, state completeness)
- Routing: pass -> auto-advance, fail -> auto-regenerate with fallback preset or queue Decision Sprint question
- Review UI: ask only exception questions (for example "Shadow still visible?") when validator confidence is uncertain

This keeps outputs consistent across whole categories (all textures, all button states, all select states) with minimal manual effort.

### 4.7 Baseline profile schema proposal

Use one persisted contract per project (with optional shared defaults) to drive prompt injection, validators, and routing.

Merge precedence:

1. Shared default baseline
2. Project baseline
3. Asset-type profile
4. Spec-level override

Proposed shape:

```json
{
  "version": 1,
  "global": {
    "noDropShadows": true,
    "background": "white_or_transparent",
    "alphaEdgeClean": "required",
    "allowPerspective": false
  },
  "assetTypeProfiles": {
    "texture": {
      "lighting": "flat",
      "tileableEdges": "required",
      "requiredStates": [],
      "stateAlignment": "n/a",
      "paddingPx": 0,
      "promptHints": ["seamless tile texture", "flat lighting", "no cast shadow"],
      "negativePromptHints": ["drop shadow", "directional light", "vignette"]
    },
    "ui_button": {
      "lighting": "flat",
      "tileableEdges": "optional",
      "requiredStates": ["default", "hover", "pressed", "disabled"],
      "stateAlignment": "exact",
      "paddingPx": 8,
      "promptHints": ["game ui button spritesheet-ready", "state variants with consistent shape"],
      "negativePromptHints": ["cast shadow", "misaligned state variants", "background texture noise"]
    },
    "ui_select": {
      "lighting": "flat",
      "tileableEdges": "optional",
      "requiredStates": ["default", "hover", "open", "disabled"],
      "stateAlignment": "exact",
      "paddingPx": 8,
      "promptHints": ["dropdown/select ui control", "consistent geometry between states"],
      "negativePromptHints": ["drop shadow", "state size drift"]
    },
    "icon": {
      "lighting": "flat",
      "tileableEdges": "optional",
      "requiredStates": [],
      "stateAlignment": "n/a",
      "paddingPx": 8,
      "promptHints": ["clean icon silhouette", "high contrast on transparent or white background"],
      "negativePromptHints": ["shadow", "background clutter", "soft blur"]
    }
  },
  "validatorPolicy": {
    "shadowCheck": { "enabled": true, "threshold": 0.8 },
    "backgroundCheck": { "enabled": true, "mode": "white_or_transparent", "threshold": 0.9 },
    "stateCompletenessCheck": { "enabled": true, "threshold": 1.0 },
    "stateAlignmentCheck": { "enabled": true, "maxPixelDrift": 1 },
    "edgeCleanlinessCheck": { "enabled": true, "threshold": 0.85 }
  },
  "routingPolicy": {
    "onPass": "auto_advance",
    "onFail": "auto_regenerate",
    "onUncertain": "queue_decision_sprint"
  }
}
```

Validator output shape (per asset/version):

```json
{
  "assetId": "asset_123",
  "versionId": "v_4",
  "checks": [
    { "id": "shadowCheck", "status": "pass", "score": 0.96 },
    { "id": "backgroundCheck", "status": "uncertain", "score": 0.63 },
    { "id": "stateCompletenessCheck", "status": "fail", "missing": ["disabled"] }
  ],
  "decision": "queue_decision_sprint",
  "suggestedQuestion": "Is background fully white or transparent?"
}
```

Implementation notes:

- Persist this as a dedicated baseline config document per project
- Apply `promptHints` and `negativePromptHints` before generation queueing
- Cache validator outcomes and show them in `BaselineValidationPanel`
- Allow explicit spec override only with reason text to avoid accidental drift

### 4.8 LoRA autopilot: from release to automatic rendering

The app should make LoRA usage feel automatic after a release is approved.

How users get to LoRA:

- `Library -> LoRAs` tab for browsing baseline + project LoRAs
- `Review -> Decision Sprint` for fast approve/reject on LoRA eval outputs
- `Settings -> LoRA policy` for default selection mode (`baseline_then_project`, etc.)

Autopilot flow:

1. Train or import a LoRA release (`candidate`)
2. Run eval grid automatically (`run_eval_grid`)
3. Decision Sprint approves release quality gates
4. Promote release to `approved` and set `activeReleaseId`
5. Trigger `lora_release_activated` automation event
6. Auto-enqueue generate jobs for compatible draft specs (same checkpoint + assetType)
7. Rendered outputs return to Pipeline review automatically

Required automation additions:

- Trigger: `lora_release_activated`
- Action: `enqueue_lora_renders` (or equivalent `enqueue_job` expansion)
- Resolution: apply project `loraSelection` policy + explicit `loraId/releaseId` override
- Guardrails: max specs per batch, dry run preview, rollback to previous active release

Required rendering plumbing:

- Extend ComfyUI bindings/templates to include LoRA node injection
- Persist resolved `loraId` + `releaseId` in generation metadata per asset version
- Show a "Rendered with LoRA <id>:<release>" badge in review/library cards

Default starter policy:

- On active release change: auto-render top 20 compatible draft specs
- If no drafts exist: queue eval prompts for the asset type
- If baseline checks fail: auto-regenerate once, then queue Decision Sprint

Baseline + project LoRA auto-connect (new, required):

1. Build a backend resolver that runs for every `generate` job with `specId`.
2. Load LoRAs from both scopes:
   - project pool: `projects/{projectId}/loras/*`
   - baseline pool: `shared/loras/*`
3. Read project `loraSelection` policy:
   - mode: `baseline_then_project` | `project_then_baseline` | `baseline_only` | `project_only` | `manual`
   - release policy: `active_or_latest_approved` | `active_only`
   - `preferRecommended`, `maxActiveLoras`
4. Filter candidates by compatibility:
   - same `checkpointId` as spec/job checkpoint
   - `assetType` included in LoRA asset types
5. Merge explicit hints + policy output:
   - explicit: job `input.loras`, spec `loraIds`
   - policy: scope-ordered candidate list, deduped, capped by `maxActiveLoras`
6. Persist resolved output on job input:
   - `input.loras[]` with `loraId`, `releaseId`, `loraName`, `strengthModel`, `strengthClip`
   - `input.loraSelection` with resolver metadata
7. Worker applies all resolved LoRAs in chain order (not just first LoRA).

Default strength bands:

- baseline LoRA strength: `0.4-0.7` (consistency/cleanup bias)
- project LoRA strength: `0.8-1.0` (style/content bias)

### 4.9 Exceptions-only autopilot loop (new default mode)

Design objective: move technical complexity out of the user's eye so review feels like a visual yes/no game.

Autopilot runtime loop:

1. Input pack: spec + baseline profile + project LoRA policy + active releases
2. Preflight resolver:
   - compile positive/negative prompts from spec + baseline hints
   - resolve checkpoint and LoRA chain (baseline + project)
   - set safe defaults for sampler/scheduler/CFG/steps/seed strategy
3. Generate candidate batch
4. Run baseline validators and confidence scoring
5. Route automatically:
   - pass -> auto-approve or auto-advance
   - fail with known fix -> auto-regenerate with fallback preset
   - uncertain -> enqueue one binary Decision Sprint question
6. Learn from answers:
   - map yes/no to tags + routing
   - offer one-click "apply to similar" for this batch
   - optionally persist as project decision rule
7. Continue until target quality or retry cap reached, then notify

UX constraints:

- By default, users never see JSON, prompt internals, or LoRA chain internals
- Manual tuning controls live behind `Expert mode` and remain collapsed
- Every uncertain case is phrased as a single visual question with clear yes/no choices

### 4.10 Spec + prompt compiler contract

Because specs and prompt intent are already well-defined, enforce a deterministic compiler layer so output quality is consistent without manual tweaking.

Compiler responsibilities:

- Expand asset-type templates into required variants/states automatically
- Inject baseline constraints (for example: no shadows, white/transparent background)
- Attach style/scenario prompt fragments from catalogs
- Inject active LoRA trigger terms and weights from resolver output
- Emit a versioned `promptPackage` stored with each generation job for reproducibility

This makes prompt quality a system concern, not a per-user burden.

---

## Part 5 — Visual Design Refinements

### 5.0 Visual north star: "Neon Mission Control"

Keep the cyberpunk identity, but make it cleaner and more premium:

- Dark, space-like canvases with subtle atmospheric gradients
- Bright accents used as guidance signals, not decoration
- Large image surfaces and calm control surfaces
- Fast binary decisions presented like mission prompts

This keeps the app expressive while reducing visual noise.

### 5.1 Card hierarchy (3 tiers)

Instead of every card looking identical, introduce visual weight tiers:

| Tier                  | Use                                       | Style                                                    |
| --------------------- | ----------------------------------------- | -------------------------------------------------------- |
| **Primary workspace** | Image preview, atlas canvas, Pixi preview | Full-width, no border, subtle inner glow, larger padding |
| **Control panel**     | Filters, settings, form inputs            | Standard card with border, muted surface                 |
| **Metadata chip**     | Status badges, tag groups, counters       | Inline, no card wrapper, badge-sized                     |

### 5.2 Glow for state, not decoration

Use the neon glow system purposefully:

| Glow                             | Meaning                        |
| -------------------------------- | ------------------------------ |
| **Purple glow** (`--ag-glow`)    | Active/selected item           |
| **Cyan glow** (`--ag-glow-cyan`) | Running/in-progress (pulsing)  |
| **Green glow** (new)             | Just completed / success flash |
| **No glow**                      | Default state                  |

### 5.3 Image-first thumbnails

Current asset cards show text metadata with a small thumbnail.
Redesign: **image fills the card**, metadata overlays at the bottom:

```
┌─────────────────┐
│                  │
│   [full-bleed    │
│    thumbnail]    │
│                  │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← gradient overlay
│ Laser Turret     │
│ ● approved  ★★★ │
└─────────────────┘
```

### 5.4 Micro-interactions

Add subtle animations to reinforce pipeline flow:

- Card slides right when it advances a pipeline stage
- Approval action triggers a brief green flash + checkmark animation
- Progress bars use the cyan glow with breathing animation while generating
- New assets fade in from the left

### 5.5 Status color language (consistent everywhere)

| Color                  | Meaning                          | Token              |
| ---------------------- | -------------------------------- | ------------------ |
| `--ag-muted` (gray)    | Draft, not started               | Neutral            |
| `--ag-accent-2` (cyan) | In progress, generating          | Active work        |
| `--ag-warning` (amber) | Needs attention, review required | User action needed |
| `--ag-success` (green) | Approved, complete               | Done               |
| `--ag-danger` (red)    | Failed, rejected                 | Problem            |
| `--ag-accent` (purple) | Selected, focused                | Current focus      |

### 5.6 Typography system (expressive but readable)

Define a strong hierarchy with non-default fonts:

- Headline/display: `Sora` (600-700) for section titles and key counts
- UI/body: `Space Grotesk` (400-500) for controls, labels, and tables
- Mono/data: `JetBrains Mono` for IDs, seeds, timings, and metadata chips

Sizing rhythm:

- H1: 32/38
- H2: 24/30
- H3: 18/24
- Body: 14/20
- Caption/meta: 12/16

Rule: no paragraph should exceed 72ch in settings panels.

### 5.7 Background, depth, and surface system

Avoid flat single-color screens. Use layered depth:

- App shell background: radial gradient + faint grid/noise texture
- Workspace panels: matte dark surface with low-contrast border
- Focus layers (review image, active card): soft inner glow + elevated shadow
- Overlays/drawers: frosted tint with high-contrast edge for separation

Token groups to standardize:

- `--ag-bg-base`, `--ag-bg-elev-1`, `--ag-bg-elev-2`
- `--ag-border-subtle`, `--ag-border-strong`
- `--ag-surface-glass`, `--ag-shadow-soft`, `--ag-shadow-focus`

### 5.8 Layout rhythm and density

Make every screen easier to scan with consistent spacing:

- 8px spacing grid across all pages
- Consistent content max-width per zone (`Pipeline` wider, `Settings` narrower)
- Sticky top context bar and sticky bottom action bar where relevant
- Minimum card height and predictable thumbnail aspect ratios (1:1 and 4:3 only)
- No mixed-density forms; compact and comfortable variants are explicit modes

### 5.9 Decision Sprint theater mode

Turn review into a focused, game-like visual flow:

- Dim background UI while reviewing; keep one question card in high focus
- Show confidence as a subtle ring/progress cue, not text clutter
- Yes/No buttons are large, mirrored, and color-consistent across all stages
- Keyboard hints are always visible in one compact footer strip
- After answer: 120-180ms transition, then immediate next frame/question

### 5.10 Empty, loading, and success states

Polish non-happy paths so the product feels intentional:

- Empty states include one visual sample + one clear CTA
- Loading uses skeleton thumbnails matching final layout (no spinners-only screens)
- Completion moments use brief success flash and "what happened next" text
- Error states provide one recovery action first, advanced diagnostics second

### 5.11 Accessibility and motion safety

Visual quality includes inclusive defaults:

- Maintain WCAG AA contrast for body text and controls
- Do not encode status by color alone; include icon/label pairing
- Respect `prefers-reduced-motion` by disabling non-essential animations
- Keep key actions reachable at 44px minimum touch target on mobile

---

## Part 6 — Component Architecture

### 6.1 New shared components

| Component                 | Purpose                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `PipelineBoard`           | Kanban board with stage columns, drag support                                              |
| `PipelineCard`            | Spec/asset card with thumbnail, status, primary action                                     |
| `ImageGrid`               | Responsive masonry/grid of image thumbnails with select                                    |
| `ReviewLightbox`          | Full-screen image review with keyboard nav                                                 |
| `SpecWizard`              | Step-by-step spec creation (replaces raw form)                                             |
| `QuickActionBar`          | Floating bottom bar with context-sensitive bulk actions                                    |
| `DetailDrawer`            | Slide-in panel for asset/atlas/export detail without page nav                              |
| `FilterBar`               | Composable faceted filter row (search + dropdowns)                                         |
| `FormBuilder`             | Structured form renderer (replaces JSON textareas in Admin/Automation)                     |
| `StatusTimeline`          | Vertical timeline showing an asset's journey through pipeline stages                       |
| `DecisionQueue`           | Ordered stack of binary questions for the active review session                            |
| `BinaryQuestionCard`      | Single-question UI with Yes/No/Skip/Undo actions                                           |
| `DecisionRuleBuilder`     | Configure question trees + answer routing without JSON                                     |
| `BaselineProfileEditor`   | Configure global and asset-type baseline quality contracts                                 |
| `BaselineValidationPanel` | Shows pass/fail checks and fallback routing for baseline rules                             |
| `LoraReleaseRail`         | Shows release lifecycle (candidate -> eval -> approved -> active) with one-click promotion |
| `LoraRenderLauncher`      | Triggers dry-run and auto-render batches for compatible specs                              |
| `ExceptionInbox`          | Queue of uncertain/failed items that need a yes/no decision from humans                    |
| `AutopilotStatusBar`      | Collapsed status row that explains what automation is doing without exposing internals     |
| `SpecCompilerPreview`     | Read-only summary of compiled prompt package for audit/debug (Expert mode only)            |

### 6.2 Page decomposition

| New zone  | Composed of                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Pipeline  | `PipelineBoard` + `PipelineCard[]` + `QuickActionBar`                                                   |
| Dashboard | `MetricsGrid` + `ActivityFeed` + `SystemStatusBar`                                                      |
| Review    | `ReviewLightbox` + `DecisionQueue` + `BinaryQuestionCard` + `VariantStrip` + `TagBar` + `RatingControl` |
| Library   | `FilterBar` + `ImageGrid` + `DetailDrawer` + `BulkActionToolbar`                                        |
| Export    | `ExportWizard` (stepped) + `PixiPreview` (embedded)                                                     |
| Settings  | `Tabs` → structured forms (FormBuilder), no raw JSON                                                    |

### 6.3 State management improvements

| Current                                       | Proposed                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 20+ `useState` per page                       | Extract into domain hooks (`usePipelineBoard`, `useReviewSession`, etc.)                 |
| No URL state                                  | Sync filters, selected asset, active tab to URL search params (`useSearchParams`)        |
| Context-only global state                     | Keep `AppDataContext` for project data; add `useFilterState` hook with URL sync          |
| Manual refresh button                         | WebSocket/SSE for job status; polling as fallback                                        |
| No keyboard bindings                          | `useHotkeys` (Mantine) for review shortcuts                                              |
| Manual decision branching                     | `useDecisionSession` with confidence thresholds, routing rules, and undo stack           |
| Ad-hoc style consistency                      | `useBaselineProfiles` + validator results mapped to auto-routing actions                 |
| LoRA promotion is disconnected from rendering | `useLoraAutopilot` to resolve compatible specs and enqueue renders on release activation |
| Users manually tune generation too often      | `useAutopilotPolicy` to keep safe defaults and gate advanced controls behind Expert mode |
| Prompt behavior drifts over time              | `usePromptCompiler` to build deterministic prompt packages from spec + baseline + policy |

---

## Part 7 — Automation UX: Rules Without JSON

Replace the current raw-JSON automation builder with a visual rule editor:

```
┌─────────────────────────────────────────────────────────┐
│  When  [Asset is approved ▼]                            │
│  And   [Spec type] [is] [animation ▼]                   │
│  Then  [Auto atlas-pack ▼]                              │
│         padding: [2]  maxSize: [2048]  trim: [✓]        │
│                                                         │
│  [+ Add condition]  [+ Add action]                      │
│                                                         │
│  ┌─ Preview ─────────────────────────────────────────┐  │
│  │  This rule will fire when an animation asset is   │  │
│  │  approved. It will pack all frames into an atlas  │  │
│  │  with 2px padding, max 2048px, trimmed.           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [Test (dry run)]              [Save and Enable]        │
└─────────────────────────────────────────────────────────┘
```

Key improvements:

- **Sentence-style builder** - "When [trigger] and [condition] then [action]"
- **Structured config** - form fields per action type, not JSON blobs
- **Natural language preview** - shows what the rule will do in plain English
- **Dry run** - test before enabling
- **Preset packs** - ship "Game UI", "Sprites", "Texture cleanup", and "LoRA rollout" presets so most teams never author rules from scratch

LoRA-specific rule pack (new):

- Trigger: `lora_release_activated`
- Conditions:
  - release status is `approved`
  - release matches project checkpoint policy
  - assetType in allowed profile list
- Actions:
  - `run_eval_grid` for smoke prompts
  - `enqueue_lora_renders` for compatible specs
  - `set_status` on affected specs (`ready` -> `rendering_with_lora`)

This makes "activate LoRA" a single action that immediately starts rendering work.

---

## Part 8 - Implementation Phases

### Phase 0: Decision Sprint + confidence routing (new first milestone)

**Scope:** `DecisionQueue`, `BinaryQuestionCard`, `useDecisionSession`, baseline validators, answer-to-action routing.

**Changes:**

- New binary review mode with `Y/N/S/U` hotkeys
- Question tree config per stage + asset type
- Baseline profile contracts for global + asset-type defaults
- Validator pipeline (shadows/background/state completeness/alignment)
- Confidence gates (`auto`, `ask`, `ask+fallback`)
- One-click "apply to similar" batch action

**Effort:** ~1.5 weeks  
**Impact:** Biggest review-speed gain; turns review into a fast yes/no loop

### Phase 0.5: No-tune autopilot and exception inbox

**Scope:** `ExceptionInbox`, `AutopilotStatusBar`, `useAutopilotPolicy`, `usePromptCompiler`.

**Changes:**

- Build preflight resolver for prompt package + safe generation defaults
- Ensure all non-critical failures route to automatic retry before asking humans
- Show only an exception queue to users; hide tuning controls in default mode
- Add Expert mode toggle for advanced users/debugging

**Effort:** ~1 week  
**Impact:** Removes most manual tuning and makes the UI feel automated by default

### Phase 1: Pipeline Board + Review Mode (highest impact)

**Scope:** New `PipelineBoard` component, `ReviewLightbox` component, keyboard shortcuts, Decision Sprint entry points.

**Changes:**

- New `PipelinePage.tsx` — assembles the kanban board from specs + assets + jobs
- New `ReviewLightbox.tsx` — full-viewport image review with hotkeys
- Add "Start Decision Sprint" CTA in Review and Pipeline columns
- Refactor navigation (5 zones + Settings)
- Existing pages remain accessible under Settings → "Classic views" (migration safety)

**Effort:** ~2-3 weeks  
**Impact:** Eliminates the biggest pain point (page-hopping) and the second-biggest (slow reviewing)

### Phase 2: Library Grid + Detail Drawer

**Scope:** `ImageGrid`, `DetailDrawer`, `FilterBar` components. Merge Assets + Atlases + Training into Library.

**Changes:**

- New `LibraryPage.tsx` with tabbed grid views
- `DetailDrawer` slides in from the right for any item (asset, atlas, LoRA)
- Faceted filtering with URL state sync

**Effort:** ~2 weeks  
**Impact:** Makes browsing 100+ assets practical; currently list-only with .slice(0,12)

### Phase 2.5: LoRA autopilot activation + render kickoff

**Scope:** `LoraReleaseRail`, `LoraRenderLauncher`, `useLoraAutopilot`, automation trigger/action additions.

**Changes:**

- Add release lifecycle rail: `candidate -> approved -> active`
- Add "Activate + Render" primary action for approved releases
- Fire `lora_release_activated` automation event on active release change
- Auto-enqueue render jobs for compatible draft specs by checkpoint + assetType
- Resolve baseline + project LoRAs automatically per generate job using project policy
- Record resolved `loraId/releaseId` in generation metadata and show it in UI badges

**Effort:** ~1 week  
**Impact:** Converts LoRA promotion into immediate output generation instead of manual handoff

### Phase 3: Smart Spec Wizard + One-Click Pipeline

**Scope:** `SpecWizard` component, "Run Pipeline" action that chains jobs.

**Changes:**

- Replace the current multi-form spec creation with a stepped wizard
- "Run Pipeline" button on draft specs that auto-chains generate → bg_remove → atlas_pack
- Visual style/scenario picker with sample thumbnails (from eval grids)

**Effort:** ~1.5 weeks  
**Impact:** Onboarding time drops from ~30 min to ~5 min for new users

### Phase 4: Structured Admin + Rule Builder

**Scope:** `FormBuilder` component, visual automation rule editor, baseline profile editor.

**Changes:**

- Replace all JSON textareas in Admin with structured forms
- Visual rule builder with sentence-style trigger/condition/action
- Baseline profile editor for per-type quality contracts and override policies
- Natural language preview + dry run

**Effort:** ~2 weeks  
**Impact:** Makes Admin and Automation accessible to non-developers

### Phase 5: Visual Polish + Micro-interactions

**Scope:** Card hierarchy tiers, glow-for-state system, typography, depth surfaces, thumbnail-first cards, animations.

**Changes:**

- CSS/theme updates for 3-tier card hierarchy
- New typography stack and tokenized type scale
- Layered background + surface token system (base/elevated/glass)
- Framer Motion or CSS transitions for pipeline card movements
- Image-first card layout with gradient overlay metadata
- Decision Sprint theater mode (focused question + fast transitions)
- Accessible motion/contrast pass across all zones

**Effort:** ~1 week  
**Impact:** Professional, cohesive visual identity

---

## Part 9 — Metrics: How to Measure Success

| Metric                                                | Current (estimated)                                  | Target                          |
| ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| Pages visited to go from spec → export                | 5-6 (Specs → Jobs → Assets → Atlases → Exports)      | 1-2 (Pipeline + Export)         |
| Clicks to approve a variant                           | 4-5 (navigate → select → expand → approve → confirm) | 1-2 (keyboard A in review mode) |
| Manual decisions per approved asset                   | ~6-10                                                | <=2                             |
| Auto-resolved review decisions                        | 0%                                                   | >=60%                           |
| Review questions answered in pure yes/no flow         | low                                                  | >=95%                           |
| Decision throughput (assets/min in review)            | ~1-2                                                 | >=6                             |
| Baseline validator pass rate on first run             | unknown                                              | >=85%                           |
| Assets requiring manual baseline correction           | high                                                 | <=10%                           |
| UI component state completeness (button/select/etc.)  | inconsistent                                         | 100% required states present    |
| Time from LoRA activation to first render queued      | manual / inconsistent                                | <=60s                           |
| Compatible draft specs auto-rendered after activation | 0%                                                   | >=90%                           |
| Manual clicks from approved LoRA -> first outputs     | 6-10                                                 | 1                               |
| Manual generation parameter edits per approved asset  | high                                                 | <=0.3                           |
| Assets reaching "review-ready" without human tuning   | unknown                                              | >=80%                           |
| Time for first export (new user)                      | ~30 min                                              | ~5 min                          |
| Assets visible at once (Assets page)                  | ~6-8 (list, 520px scroll)                            | 24+ (grid)                      |
| Nav items                                             | 13                                                   | 5+1                             |
| Pages with raw JSON editing                           | 3 (Admin, Automation, Chained Jobs)                  | 0                               |

## | Review viewport dedicated to image content | unknown | >=70% |

## Part 10 — File Structure (proposed)

| Screens using standardized typography/surface tokens | low | 100% |

```
apps/frontend/src/ui/
├── App.tsx                          # Routes (5 zones + settings)
├── layouts/
│   └── AppShellLayout.tsx           # Slim nav (5+1 items)
├── components/                      # Shared building blocks
│   ├── PipelineBoard.tsx
│   ├── PipelineCard.tsx
│   ├── ImageGrid.tsx
│   ├── ReviewLightbox.tsx
│   ├── DecisionQueue.tsx
│   ├── BinaryQuestionCard.tsx
│   ├── SpecWizard.tsx
│   ├── QuickActionBar.tsx
│   ├── DetailDrawer.tsx
│   ├── FilterBar.tsx
│   ├── FormBuilder.tsx
│   ├── DecisionRuleBuilder.tsx
│   ├── StatusTimeline.tsx
│   ├── HelpTip.tsx                  # (existing)
│   └── VariantStrip.tsx
├── pages/
│   ├── pipeline/
│   │   ├── PipelinePage.tsx
│   │   └── usePipelineBoard.ts
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   └── ActivityFeed.tsx
│   ├── review/
│   │   ├── ReviewPage.tsx
│   │   ├── useReviewSession.ts
│   │   └── DecisionSprintPage.tsx
│   ├── library/
│   │   ├── LibraryPage.tsx
│   │   ├── AssetsTab.tsx
│   │   ├── AtlasesTab.tsx
│   │   ├── LorasTab.tsx
│   │   └── ExportsHistoryTab.tsx
│   ├── export/
│   │   ├── ExportPage.tsx
│   │   └── ExportWizard.tsx
│   └── settings/
│       ├── SettingsPage.tsx         # Tabs: Catalogs, Checkpoints, LoRAs, Automation, Logs, Help
│       ├── CatalogsForm.tsx
│       ├── CheckpointsForm.tsx
│       ├── AutomationRuleBuilder.tsx
│       └── LogsViewer.tsx
├── hooks/                           # (existing + new)
│   ├── usePipelineBoard.ts
│   ├── useReviewSession.ts
│   ├── useDecisionSession.ts
│   ├── useFilterState.ts            # URL-synced faceted filtering
│   ├── useHotkeys.ts                # Keyboard shortcut bindings
│   └── ... (existing hooks)
├── context/
│   └── AppDataContext.tsx            # (existing)
├── styles.css                       # + new tier tokens
└── ...
```

Additional baseline files to include in this structure:

- `components/BaselineProfileEditor.tsx`
- `components/BaselineValidationPanel.tsx`
- `pages/settings/BaselineProfilesForm.tsx`
- `hooks/useBaselineProfiles.ts`

Additional LoRA autopilot files to include in this structure:

- `components/LoraReleaseRail.tsx`
- `components/LoraRenderLauncher.tsx`
- `hooks/useLoraAutopilot.ts`
- `pages/review/LoraActivationQueue.tsx`

Additional exceptions-only autopilot files to include:

- `components/ExceptionInbox.tsx`
- `components/AutopilotStatusBar.tsx`
- `components/SpecCompilerPreview.tsx`
- `hooks/useAutopilotPolicy.ts`
- `hooks/usePromptCompiler.ts`

---

## Summary

The redesigned direction now centers on five transformative changes:

1. **Decision Sprint UX** - review becomes a rapid yes/no loop ("Do you see a dog?"),
   with confidence-based auto-resolution and one-key answers for humans when needed.

2. **Pipeline Board** - a visual kanban that shows assets flowing through
   Draft -> Generate -> Review -> Alpha -> Atlas -> Export, replacing 5 separate pages
   with one persistent view.

3. **Immersive Review** - a full-screen, keyboard-driven lightbox where the
   image dominates and approve/reject is a single keypress, replacing the current
   cramped split-panel with its 500-line component.

4. **Automation by default** - one-click "Run Pipeline" chains all jobs,
   baseline quality contracts enforce common constraints, question-tree answers trigger
   routing automatically, LoRA activation auto-kicks compatible render batches, and the
   visual rule builder replaces raw JSON so the pipeline runs mostly on autopilot.

5. **Exceptions-only operations** - users spend most of their time in visual yes/no review,
   while prompt compilation, baseline enforcement, LoRA chaining, retries, and routing stay
   automated and mostly invisible unless Expert mode is opened.

Everything else - card hierarchy, grid library, structured forms, URL-synced state,
micro-interactions - supports these pillars by making the tool feel like a
**visual creative studio** with a game-like decision engine rather than a developer admin panel.
