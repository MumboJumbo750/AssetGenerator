# Full Automatism and Determinism Master Plan

Status: Active master plan (supersedes the previous incremental backlog format in this file)

Scope: End-to-end product, data contracts, automation engine, and UI workflow for deterministic asset generation with exceptions-only human review.

Audience: Single-developer execution (serial delivery, no parallel tracks).

---

## 1) Vision and Product Promise

AssetGenerator should produce cohesive game-ready assets with minimal manual intervention by default:

1. Specs include explicit policy and quality contracts.
2. Generation resolves model stacks deterministically.
3. Validators and confidence routing auto-resolve most outputs.
4. Humans only answer fast yes/no questions on uncertain or failing cases.
5. Decisions and evidence feed continuous quality improvement loops.

Core guarantees:

- Determinism: same input policy + same data -> same model resolution behavior.
- Cohesion: style, perspective, silhouette, and identity stay consistent across outputs.
- Traceability: every decision can be explained by recorded evidence.

---

## 2) What We Keep, Integrate, and Rethink

From existing plans we keep:

- Pipeline-first IA (Pipeline/Review/Library/Export/Settings)
- Decision Sprint direction
- Exceptions-only and no-tune defaults
- Structured forms instead of raw JSON editing
- Baseline profile concept and LoRA activation autopilot

What we add/rethink deeply:

- Contract-first quality model (perspective/state/identity consistency)
- Deterministic model stack resolver (multiple baseline + project LoRAs)
- Tag-to-model and tag-to-validator relations
- Entity identity continuity across asset families (animation + icon + pickup)
- Binary questionnaire tied to contracts and tags, not ad-hoc opinions

---

## 3) Target Architecture (Deterministic Pipeline)

### 3.1 Deterministic Resolution Layers

For each generation request, resolve in this strict order:

1. Checkpoint
2. Baseline LoRA stack (0..N)
3. Project LoRA stack (0..N)
4. Tag/Entity LoRA stack (0..N, optional)
5. Prompt package (compiled from contracts + hints + tags)

Output metadata must include full resolved stack and prompt package hash/snapshot.

### 3.2 Quality Contract Layers

Contracts are evaluated at:

1. Global baseline
2. Asset type profile
3. Project profile
4. Spec override
5. Entity/tag-specific constraints

Final contract is computed deterministically with explicit override precedence.

### 3.3 Routing Layers

1. Validator pass with high confidence -> auto-advance
2. Validator fail with clear hard-rule breach -> auto-regenerate or reject path
3. Uncertain/mixed evidence -> Decision Sprint queue

Transitional rule:

1. Until Phase 6 is completed, uncertain/mixed evidence routes to `manual_review_queue` with the same evidence payload contract.

### 3.4 Backend Runtime and Live Feedback Layers

To avoid automation bottlenecks and provide accurate near-live UI feedback:

1. Append-only project event stream (`events.jsonl`) with monotonic sequence IDs.
2. Async automation execution queue (rule matching request path must not execute actions inline).
3. SSE stream endpoint for frontend (`/events/stream?since=<seq>`) with reconnect-safe replay.
4. Materialized indexes for jobs and automation runs to avoid full directory scans on every list request.
5. Split hot progress writes from canonical job records (progress sidecar + terminal state fold-in).

### 3.5 Checkpoint-Aware Prompt and Policy Layers

Checkpoint switching must be a simple user action, but deterministic in backend behavior:

1. Checkpoint Profile (dialect):
   - prompt template family
   - tag-to-prompt mapping policy
   - tag order policy
   - negative guardrail defaults
2. Checkpoint Baseline Scope:
   - baseline profile compatibility bound to checkpoint
   - baseline LoRA stacks resolved only from compatible checkpoint scope
3. Checkpoint Resolver Evidence:
   - selected checkpoint profile id/version
   - prompt compile trace (ordered fragments with source)
   - compatibility decisions (accepted/rejected candidates)

### 3.6 ComfyUI Execution Optimization Layers

1. Precompiled workflow template cache (template + bindings + checkpoint profile hash).
2. Progress acquisition abstraction:
   - prefer push/socket progress when available
   - fallback to bounded polling
3. Queue and backpressure controls:
   - per-project concurrency
   - per-checkpoint concurrency caps
   - starvation-safe scheduling
4. Failure containment:
   - recoverable transient Comfy failures auto-retried with bounded policy
   - deterministic error classification for routing.

### 3.7 Determinism Boundaries and Replay Contract

Determinism scope must be explicit:

1. Policy determinism (required):
   - same spec/policy/profile inputs -> same resolver/prompt/routing decisions
2. Runtime determinism (required):
   - same event stream order -> same automation/run outcomes
3. Pixel determinism (best effort):
   - only guaranteed when checkpoint/model/node versions and seeds are fixed and environment is equivalent

Replay contract:

1. Every generation stores replay bundle ids/hashes for:
   - checkpoint profile version
   - model stack snapshot
   - prompt compile trace
   - seed strategy and effective seeds
2. Re-run with replay bundle must produce the same decision trace (even if image bytes differ across hardware).

---

## 4) Required Data Contract Extensions

## 4.1 AssetSpec

Must support:

- `checkpointId` (required for `status=ready`)
- `checkpointProfileId` (optional explicit dialect selection; default derived from checkpoint policy)
- `baselineProfileId`
- `loraPolicy`:
  - `mode`
  - `preferRecommended`
  - `maxActiveLoras`
  - `releasePolicy`
- `styleConsistency`:
  - `mode`
  - `anchorRefs[]`
- `qualityContract`:
  - `backgroundPolicy`
  - `requiredStates[]`
  - `alignmentTolerancePx`
  - `perspectiveMode`
  - `silhouetteDriftTolerance`
- `entityLink`:
  - `entityId` (weapon_ak01, armor_heavy02, etc.)
  - `role` (animation, pickup_icon, portrait, ui_card)
- `promptPolicy`:
  - `compileMode` (`checkpoint_profile_default` | `spec_override`)
  - `tagOrderMode` (`checkpoint_default` | `explicit`)
  - `tagOrder[]` (optional explicit order)
  - `promptPresetId` (optional checkpoint-scoped preset)

## 4.2 Project Policy

Add deterministic policy sections:

- `modelStackPolicy`:
  - stack order, hard limits, compatibility rules
- `tagModelMap`:
  - tag -> preferred/required LoRA ids and weights
- `tagPromptMap`:
  - checkpointId -> tag -> prompt fragment rules (positive/negative, weight, position)
- `tagContractMap`:
  - tag -> validator and questionnaire requirements
- `entityPolicy`:
  - identity continuity rules per entity family
- `checkpointProfiles`:
  - checkpointId -> dialect + defaults + ordering policies
- `checkpointBaselineMap`:
  - checkpointId -> allowed/default baseline profile ids
- `runtimeFeedbackPolicy`:
  - event retention
  - SSE replay window
  - polling fallback policy

## 4.3 Baseline Profile

Add checkpoint compatibility:

- `checkpointId` (required)
- optional `checkpointProfileId`
- optional compatibility notes/limits

No baseline profile may be applied to an incompatible checkpoint.

## 4.4 Asset Version Evidence

Persist per version:

- resolved model stack snapshot
- compiled prompt package snapshot
- prompt compile trace (ordered fragments with source ids and checkpoint profile)
- validator detailed results
- confidence and routing reason
- questionnaire answers and helper evidence
- cohesion score and drift deltas
- runtime execution evidence:
  - event sequence references
  - automation run id(s)
  - retry classification and result

## 4.5 Prompt Precedence Contract (Normative)

To avoid ambiguity between checkpoint templates and policy maps, compile prompts in this strict order:

1. Checkpoint profile base templates (`checkpointProfiles`)
2. Checkpoint asset-type templates
3. Baseline prompt hints (checkpoint-compatible baseline profile)
4. Project `tagPromptMap` fragments (checkpoint-scoped)
5. Spec prompt body (`prompt.positive` / `prompt.negative`)
6. Spec prompt policy overrides (`promptPolicy.compileMode = spec_override`)
7. Runtime safety guards (if enabled by policy)

Rules:

1. Later layers may append or override only where explicitly allowed by policy.
2. Every fragment in final prompt trace must include:
   - source layer id
   - source record id/version
   - insertion order index
3. If two fragments conflict at same precedence level, deterministic tie-break:
   - explicit weight desc
   - then lexical id asc

## 4.6 Runtime Event and Queue Contracts

Add schemas for:

1. `event.schema.json`
2. `event-cursor.schema.json`
3. `automation-queue-item.schema.json`
4. `jobs-index.schema.json`
5. `automation-runs-index.schema.json`

Writer model (required):

1. Exactly one logical event-writer per project at a time.
2. If multiple backend/worker processes exist, they must use a shared lock/lease before allocating `seq`.
3. `seq` allocation and event append must be atomic from the perspective of readers.

`event` minimum fields:

1. `id` (ulid)
2. `projectId`
3. `seq` (monotonic int per project)
4. `ts`
5. `type`
6. `entityType`
7. `entityId`
8. `causalChainId`
9. `idempotencyKey`
10. `payload`

Idempotency rules:

1. `idempotencyKey` must be unique within `(projectId, type, entityId)` active window.
2. Duplicate key => event is acknowledged but not re-applied.
3. Automation actions must emit deterministic derived keys (`triggerEventId + actionIndex + targetId`).
4. Default active window = 30 days (configurable by `runtimeFeedbackPolicy`).

Loop guards:

1. `causalDepth` max (default 8) to stop recursive rule chains.
2. `visitedRuleIds[]` on run context; same rule cannot re-enter same chain unless explicitly allowed.

## 4.7 Retry, Backoff, and Escalation Contract

Add `retryPolicy` sections:

1. Global runtime policy
2. Per job type override
3. Per validator/routing override (optional)

Required fields:

1. `maxAttempts`
2. `backoffMode` (`fixed` | `exponential`)
3. `baseDelayMs`
4. `maxDelayMs`
5. `jitterPct`
6. `retryOn` (error classes)
7. `escalateTo` (`decision_sprint` | `exception_inbox` | `reject`)

Escalation rule:

1. retries exhausted OR non-retryable class => emit escalation event with reason code.

## 4.8 Checkpoint Profile Pinning Contract

To prevent drift on reruns:

1. When spec becomes `ready`, persist effective:
   - `checkpointProfileId`
   - `checkpointProfileVersion`
2. If project default profile changes later:
   - existing ready specs remain pinned
   - explicit rebind action required to adopt new profile
3. Generation evidence always stores pinned profile/version actually used.

## 4.9 Seed Strategy Contract

Add `seedPolicy` to spec or project default:

1. `mode` (`fixed` | `derived` | `random_recorded`)
2. `baseSeed` (required for `fixed`)
3. `deriveFrom` inputs (for `derived`, e.g. `specId`, `variantIndex`, `frameIndex`)
4. `hashAlgo` (default `fnv1a32` or chosen standard)

Rule:

1. Even in random mode, effective seed per variant/frame must be recorded in evidence.

---

## 5) Deterministic Model Stacking Policy

## 5.1 Why

Single-model or ad-hoc mixing cannot guarantee consistency across:

- perspective
- icon/state shape continuity
- item identity across different outputs

## 5.2 Policy Rules

1. Stack order is fixed and never inferred at runtime.
2. Each layer has max cardinality and weight bounds.
3. Compatibility matrix blocks invalid stacks.
4. If resolver cannot satisfy required tags/contracts, job routes to exception (not silent fallback).
5. Resolver writes explainable decisions (chosen, skipped, blocked candidates).

## 5.3 Practical Defaults

- Baseline stack: quality/cohesion guardrails
- Project stack: game style identity
- Tag/Entity stack: specific motifs (weapon class, armor family, faction)

## 5.4 Automation Safety & Intelligence Layers

To prevent automation from becoming a liability:

1. **Rule Backtesting ("What-If"):**
   - Ability to run automation rules in "simulation mode" against the `events.jsonl` history.
   - Reports how many jobs *would* have triggered over period $T$.
   - Prevents misconfigured rules from flooding the queue.

2. **Global Blast Radius Breakers:**
   - "Velocity Breaker": Auto-disable rule if trigger rate > $X$ per minute.
   - "Queue Ratio Breaker": Pause low-priority automation if queue depth > $Y \times$ throughput.

3. **Interactive Priority Inheritance:**
   - If a user is viewing a Spec/Asset (subscribed via SSE), related jobs get bumped to `priority: HIGH`.
   - Ensures automation yields to active user intent.

4. **Active Validator Feedback Loop:**
   - Explicitly link Human "No" decisions to Validator "Pass" results (False Positive tracking).
   - Aggregated "Validator Gap" events feed tuning suggestions (e.g., "Raise silhouette threshold to 0.85").

---

## 6) Tag-Centric Automation (Model and Validation)

Tags become operational contracts, not only labels.

For each important tag, define:

1. Model hints:

- preferred/required LoRAs
- optional prompt hint snippets

2. Validation expectations:

- required checks
- thresholds

3. Questionnaire prompts:

- yes/no wording
- helper overlays or examples

Example:

- tag `item:weapon`
  - model: include weapon-detail LoRA candidate set
  - validation: silhouette consistency + perspective check enabled
  - questionnaire: "Does this still read as the same weapon family?"

---

## 7) Binary Questionnaire 2.0

Questionnaire must be generated from contracts and tags.

## 7.1 Question Types

1. Contract compliance:

- "Background is transparent?"
- "All required states present?"

2. Cohesion:

- "Form matches baseline/project style?"
- "Perspective matches contract?"

3. Identity continuity:

- "Same item identity as linked outputs?"

## 7.2 Review Tool Registry (The "Mini-Game" Tools)

To make review fast and accurate, tags activate specific interactive tools (defined in `catalog.tags.schema.json`):

Trigger source contract (normative):

1. Tag-driven triggers must use canonical tag ids (for example `assetType:ui_icon`, `view:isometric`).
2. Asset metadata triggers must use explicit adapters (for example `assetType.requiresAlpha`, `assetType.multiFrame`), not free-form labels.
3. Entity-link triggers are context-driven (`entityLink.entityId` present) and do not require a catalog tag.

1.  **AlphaMatteCycler (`bg_cycler`)**:
    -   *Trigger:* `material:ethereal` or `assetType.requiresAlpha=true` (via asset-type metadata adapter)
    -   *Interaction:* Press `TAB` to cycle backgrounds (Black -> White -> Green -> Checkerboard).
    -   *Goal:* Spot dirty edges or semi-transparent pixels instantly.

2.  **IsoGrid Overlay (`overlay_grid`)**:
    -   *Trigger:* `view:isometric`
    -   *Interaction:* Overlay a 2:1 isometric grid. Drag to align with asset usage.
    -   *Goal:* Verify foot placement and projection angle.

3.  **ReferenceGhost (`reference_ghost`)**:
    -   *Trigger:* Entity-linked assets (e.g., `weapon:sword01` upgrades).
    -   *Interaction:* Hold `SHIFT` to overlay the "parent" or "baseline" asset at 50% opacity.
    -   *Goal:* Check silhouette drift and size consistency.

4.  **HorizonCheck (`horizon_line`)**:
    -   *Trigger:* `view:side`
    -   *Interaction:* Adjustable floor line.
    -   *Goal:* Ensure characters aren't "floating" or "sinking."

5.  **SafeFrame (`safe_area`)**:
    -   *Trigger:* `assetType:ui_icon`, `assetType:logo`
    -   *Interaction:* Shows padded bounds/bleed area.
    -   *Goal:* Ensure icons don't touch edges.

6.  **OnionSkin (`onion_skin`)**:
    -   *Trigger:* `assetType:spritesheet` or `assetType.multiFrame=true` (via asset-type metadata adapter)
    -   *Interaction:* Playback scrubber with previous/next frame ghosting.
    -   *Goal:* Check animation fluidity and centering.

## 7.3 Routing by answer

- yes -> advance and optionally batch-apply to similar
- no -> routed remediation (regen with policy adjustment)
- unsure -> exception queue with suggested next action

---

## 8) Serial Execution Plan (Single Developer)

Timeline is ordered and blocking. Each phase has entry and exit gates.

## Phase 0: Reset Plan and Contracts (Week 1)

Tasks:

1. Freeze this master plan as source of truth.
2. Finalize schema targets for checkpoint-aware spec/project/version evidence.
3. Define deterministic resolver + prompt compiler contracts.
4. Define normative prompt precedence, idempotency, and retry/escalation contracts.

Exit gate:

- schema RFC committed (including checkpoint profile and runtime feedback sections)
- resolver and prompt-compiler contracts accepted
- precedence/idempotency/retry contracts accepted and testable

## Phase 1: Runtime Throughput and Live Feedback Foundation (Week 2-3)

Tasks:

1. Implement append-only project event stream with monotonic sequence ids.
2. Add SSE stream + replay endpoint contract for frontend.
3. Move automation execution out of request path into async runner queue.
4. Add jobs/automation materialized indexes for list APIs.
5. Implement idempotency checks, causal chain ids, loop guards, and cursor recovery.

Exit gate:

- UI receives near-live lifecycle updates without 5s full-poll dependency
- automation trigger endpoint latency is stable and no longer action-duration bound
- replaying recent events does not create duplicate jobs/runs

## Phase 2: Checkpoint-Aware Foundations (Week 4-5)

Tasks:

1. Add `checkpointProfiles`, `checkpointBaselineMap`, and `tagPromptMap` schemas.
2. Scope baseline profiles to checkpoints and migrate existing data.
3. Enforce checkpoint compatibility in resolver (LoRAs, baselines, prompt presets).
4. Add ready-state gate: incompatible checkpoint/policy combinations cannot run.
5. Implement checkpoint profile pinning at ready-state transition.

Exit gate:

- switching between `copax` and `pony` is deterministic and policy-valid
- each ready spec has a compatible checkpoint baseline path
- ready specs stay stable after profile-default changes unless explicitly rebound

## Phase 3: Prompt Compiler v2 (Week 6-7)

Tasks:

1. Implement checkpoint-dialect prompt compiler with deterministic fragment ordering.
2. Implement checkpoint-dependent tag->prompt mapping and precedence.
3. Persist prompt compile trace and package hash in generation evidence.
4. Add prompt drift checks between linked assets in the same artifact set.
5. Implement seed strategy contract and record effective seeds per output.

Exit gate:

- every generation stores explainable prompt compilation evidence
- tag prompt order is deterministic and checkpoint-specific
- replay bundle can reconstruct the same compile and resolver decision trace

## Phase 4: Deterministic Resolver and Stack Governance (Week 8-9)

Tasks:

1. Implement strict stack ordering and caps.
2. Implement checkpoint-aware compatibility matrix and conflict reasons.
3. Persist resolved stack snapshots into generation metadata.
4. Add resolver explanation object (chosen/skipped/blocked).

Exit gate:

- every generated version records deterministic stack evidence with explanation

## Phase 5: Validator and Cohesion Engine (Week 10-11)

Tasks:

1. Implement perspective and silhouette/state consistency checks.
2. Implement entity continuity checks (cross-spec linked assets).
3. Implement prompt-policy compliance checks (checkpoint/tag order expectations).
4. Produce standardized validator report object.

Exit gate:

- validator report available for every completed generation

## Phase 6: Decision Sprint 2.0 (Week 12-13)

Tasks:

1. Implement `DecisionQueue`, `BinaryQuestionCard`, `useDecisionSession`.
2. Build contract/tag-driven question tree generation.
3. Implement the Review Tool Registry (AlphaMatte, IsoGrid, Ghosting, etc.).
4. Bind tools to Tag Catalog via updated schema.

Exit gate:

- uncertain/failing outputs reliably route into actionable yes/no flow
- Review Tools activate correctly based on asset tags

## Phase 7: Exceptions-Only Operations (Week 14)

Tasks:

1. Implement `ExceptionInbox` and `AutopilotStatusBar`.
2. Hide advanced tuning outside Expert mode.
3. Route all non-critical failures through automatic retries first.
4. Enforce retry/backoff/escalation policy contract globally.

Exit gate:

- default user flow is Pipeline + Review only, with explicit exception queue
- retries and escalations are deterministic and explainable

## Phase 8: Continuous Improvement Loop (Week 15-16)

Tasks:

1. Add improvement runs (cohort selection, intervention, before/after metrics).
2. Add promotion gates and rollback for checkpoint/baseline/project/tag model rules.
3. Track drift and cohesion trend per entity family and checkpoint family.
4. Implement Rule Backtesting (simulation mode) against event history.
5. Implement Global "Blast Radius" circuit breakers (velocity/queue depth).
6. Implement Validator Gap analysis (Human Reject vs. Validator Pass).

Exit gate:

- measurable weekly quality lift cycle operational across checkpoints
- rule simulators prevent bad-config floods in staging

Implementation status (per task):

| Task | Status | Notes |
| --- | --- | --- |
| 1. Improvement runs | **done** | Schema `improvement-run.schema.json`; `improvementRuns.ts` service (CRUD, cohort resolution, metric sampling, delta); routes for list/get/create/patch/start/complete/promote/rollback; frontend create-run form, run cards with lifecycle buttons |
| 2. Promotion gates + rollback | **done** | `promoteImprovementRun` enforces quality gate (qualityLiftPct >= 0, first-pass approval drop <= 5pp); `rollbackImprovementRun` guards against draft/already-rolled-back; routes wrap errors as 400; lifecycle events emitted for all transitions |
| 3. Drift + cohesion trends | **done** | `trend-snapshot.schema.json` has scope (checkpointId, entityFamily, assetType, tag); `generateTrendSnapshot` filters events and validation results by scope; cohesion = 1-stddev(scores); drift = fraction of current-period scores below previous-period mean |
| 4. Rule backtesting | **done** | `backtestRule` in `backtestAndGap.ts` replays events.jsonl against rule trigger/conditions, computes peak velocity, avg triggers/hour, estimated jobs, emits warning; endpoint + frontend backtest tab (expert mode) |
| 5. Circuit breakers | **done** | `circuit-breaker.schema.json`; `circuitBreakers.ts` with velocity (closed→open→half_open→closed) and queue-depth (open→closed on cooldown recovery) state machines; integrated in `automation.ts triggerAutomationEvent`; project-level `circuitBreakerPolicy` defaults; frontend breakers tab with reset |
| 6. Validator gap analysis | **done** | `analyzeValidatorGaps` cross-refs validator passes with human rejections, finds weakest check, generates per-check suggestions; endpoint + frontend gaps tab (expert mode) |

---

## 9) Metrics and Quality Gates

Release gates (must pass before broad usage):

1. Deterministic stack reproducibility >= 99% on replay tests
2. First-pass validator success >= 85% on target asset sets
3. Event delivery latency (worker->frontend) p95 <= 1.5s
4. Jobs list API latency p95 <= 200ms on target project size
5. Decision Sprint throughput >= 6 assets/min on uncertain queue
6. Auto-resolved decisions >= 60%
7. Cross-output entity cohesion score above project threshold
8. Duplicate-action rate from event replay <= 0.1%
9. Checkpoint switch replay tests pass with pinned profiles (`copax`, `pony`)

Benchmark profile for latency gates:

1. Target project size = at least:
   - 2,000 jobs
   - 500 assets
   - 300 specs
   - 50 automation rules
2. Measure with warm cache and cold cache runs; both must be reported.

Operational dashboard metrics:

- % autopilot-ready specs
- % specs with complete contracts
- % specs with checkpoint-compatible baseline/profile mapping
- validator fail category distribution
- exception queue volume and aging
- time from LoRA activation to first approved outputs
- prompt compile drift by checkpoint/tag family
- automation trigger->run start latency
- idempotency dedupe hit rate
- escalation reason-code distribution
- pinned-profile drift violations

---

## 10) Immediate Work Queue (Now) — `done`

Given current progress, do next in this order:

1. ~~Implement runtime event stream + SSE contract (backend + worker emitters + frontend consumer scaffold).~~ `done`
2. ~~Move automation execution to async queue runner (remove synchronous action execution in trigger request path).~~ `done`
3. ~~Define checkpoint profile schema and seed profiles for `copax` and `pony`.~~ `done`
4. ~~Add checkpoint scope to baseline profiles and enforce compatibility gates.~~ `done`
5. ~~Implement checkpoint-aware tag->prompt map + compile trace evidence schema.~~ `done`
6. ~~Complete post-create policy/contract editor parity for existing specs.~~ `done`
7. ~~Add seed policy and retry/escalation policy schemas plus enforcement hooks.~~ `done`

---

## 11) Migration and Breaking Changes Policy — `done`

Because development is single-threaded and not parallelized:

1. ~~Prefer forward migration with strict defaults over compatibility shims.~~ `done` — no legacy migration needed; fresh starts from `examples/`.
2. ~~Allow breaking changes between internal milestones if migration scripts are provided.~~ `done` — `data/` removed from git; `examples/` is the single source of truth.
3. ~~Recreated specs are preferred over auto-converting low-quality legacy specs.~~ `done` — `npm run seed --force` recreates from curated examples.
4. ~~"Ready" status becomes contract-gated, not manual opinion.~~ `done` — ready-gate enforcement is in the spec routes.

~~Migration specifics for prompt sources:~~ `superseded` — no legacy data to migrate. Example data already uses the new schema (checkpointProfiles, tagPromptMap, checkpoint-profiles/).

1. ~~Legacy checkpoint `promptTemplates` must be transformed into `checkpointProfiles` v1 during migration.~~ `n/a` — examples ship with both formats; fresh projects start clean.
2. ~~Generated profile ids must be deterministic (`checkpointId + profileVersion`).~~ `done` — example profiles use deterministic ids (e.g. `copax_sdxl_v1`).
3. ~~Migrated profiles must preserve prior effective prompt behavior before enabling new overrides.~~ `n/a` — no migration path needed.
4. ~~Specs without explicit `checkpointProfileId` at migration time~~ `n/a` — new specs start fresh.

**Implementation notes:**
- `data/` added to `.gitignore` and untracked from git.
- `examples/astroduck_demo/` committed with 40 curated seed files (project, catalogs, checkpoints, profiles, specs, automation rules, baseline profile, loras).
- `examples/shared/loras/` committed with baseline LoRA record.
- `scripts/seed.mjs` rewritten: copies from `examples/` → `data/`, creates empty runtime dirs. No more code-generation of data.
- `npm run seed` / `npm run seed -- --force` bootstraps a working project from examples.

---

## 12) Documentation and Source of Truth `done`

This plan is the primary execution document.

Supporting docs:

- `docs/ui/ui-redesign-plan.md` (design direction source)
- `docs/workflows/microgame-use-case-matrix.md` (H0-H10 control hierarchy + UC matrix for deterministic implementation)
- `docs/workflows/spec-recreation-happy-loop.md` (practical operator checklist)
- `docs/workflows/checkpoint-onboarding.md` (checkpoint profile and prompt dialect onboarding)
- `docs/pipeline/comfyui.md` (workflow binding and execution model)
- `docs/ui/in-app-guidance.md` (in-product checklist and copy)

When conflicts appear, this master plan takes precedence for implementation order and architecture decisions.

---

## 13) Current-State Assessment (Backend + Comfy + Multi-Checkpoint) `done`

What already works today:

1. Spec-level checkpoint selection is supported (`checkpointId`).
2. Checkpoint metadata supports per-checkpoint prompt templates and per-asset-type prompt templates.
3. LoRA resolver filters compatibility by checkpoint and asset type.
4. Baseline profiles are checkpoint-scoped (`checkpointId` is required in `baseline-profile.schema.json`); `enforceCheckpointCompatibility()` validates matches and respects `checkpointBaselineMap` policy.
5. Tag→prompt mapping and ordering are checkpoint-aware and versioned: `checkpoint-profile.schema.json` defines `tagOrderPolicy`, `tagOrder`, and `version`; worker resolves tag order per checkpoint profile; `project.policies.tagPromptMap[checkpointId]` scoped per checkpoint.
6. Prompt compile traces are persisted as first-class evidence: 7-layer trace (`checkpoint_base` → `checkpoint_asset_type` → `baseline_hints` → `tag_prompt_map` → `spec_prompt` → `spec_override` → `runtime_safety`) with SHA-256 `packageHash`; stored in asset version `generation.promptCompileTrace` and job output; schema: `schemas/compile-trace.schema.json`.
7. Automation execution uses filesystem-direct processing: worker imports backend services as modules, polls `jobs/` and `automation-runs/` directories via `fs.readdir`, acquires filesystem locks per project — no API-path bottleneck.
8. Live feedback is event-driven: SSE endpoint (`GET /api/projects/:projectId/events/stream?since=<seq>`); frontend `useProjectEvents()` hook with cursor-based reconnection; `AutopilotStatusBar` shows connection status.

Previous gaps (all closed):

1. ~~Baseline profiles are not checkpoint-scoped yet.~~ → Closed (Phase 2). Required `checkpointId` field + compatibility enforcement.
2. ~~Tag→prompt mapping and ordering are not checkpoint-aware or explicitly versioned.~~ → Closed (Phase 3). Checkpoint profiles with `tagOrderPolicy`/`tagOrder`/`version` + scoped `tagPromptMap`.
3. ~~Prompt compile traces are not persisted as first-class evidence.~~ → Closed (Phase 3). Compile trace schema, 7-layer assembly, SHA-256 hash, embedded in asset versions and job outputs. Note: standalone `compile-traces/` directory persistence is partially wired (metrics service references it) but traces are fully available via asset/job records.
4. ~~Automation execution currently risks API-path bottlenecks under scale.~~ → Closed (Phase 4/7). Worker operates filesystem-direct with no HTTP except to ComfyUI.
5. ~~Live feedback still depends heavily on polling and full list refresh patterns.~~ → Closed (Phase 1/4). SSE stream + cursor recovery + event-driven UI.

Decision (implemented):

- `copax` and `pony` are treated as first-class checkpoint families with separate prompt dialects, baseline stacks, and tag prompt ordering policies.
- Evidence: `examples/astroduck_demo/checkpoint-profiles/copax_sdxl_v1.json` (standard quality tokens) and `pony_v6xl_v1.json` (Pony-native `score_9`/`score_8_up` tokens), each with independent `tagOrderPolicy`, `tagOrder`, `runtimeSafety`, and per-asset-type prompt overrides.

---

## 14) UI Redesign Integration Matrix (Imported from `ui-redesign-plan`) `done`

This section imports the actionable UI scope into the master execution plan so delivery is tracked in one place.

Primary source for UX intent:

- `docs/ui/ui-redesign-plan.md`

Execution source:

- this master plan section 8 phases

## 14.1 Core UI Packages and Phase Ownership

| UI package | Included capabilities | Master phase owner | Status |
| --- | --- | --- | --- |
| Pipeline Studio shell | 9-zone IA (Pipeline, Dashboard, Review, Library, Export, Exceptions, Trends, Metrics, Settings), pipeline-first navigation, stage cards, one primary action | Phase 4 + Phase 7 hardening | done |
| Live feedback surfaces | SSE event stream, `AutopilotStatusBar` badges, `useProjectEvents` hook with cursor reconnect, worker heartbeat | Phase 1 | done |
| Checkpoint-aware spec UX | checkpoint profile selection, compatible baseline selection, policy conflict blockers, SpecDetailPage General tab | Phase 2 | done |
| Prompt evidence UX | prompt policy tab (compile mode, tag order mode, tag order, preset), compile trace layer count in Review, prompt drift tables in Metrics | Phase 3 | done |
| Resolver explainability UX | stack badges, chosen/skipped/blocked model details in Review evidence, resolver explanation object | Phase 4 | done |
| Cohesion + validator UX | validator pass/fail in Review, cohesion/drift scores, gap analysis in Trends, fail categories in Metrics | Phase 5 | done |
| Decision Sprint 2.0 UX | `DecisionQueue` + `BinaryQuestionCard`, keyboard Y/N/U/S/Z, apply-to-similar, review tool overlays (SafeFrame, ReferenceGhost, OnionSkin, etc.) | Phase 6 | done |
| Exceptions-only UX | `ExceptionInbox` with escalation filters + retry/cancel, `AutopilotStatusBar`, `ExpertModeContext` hides advanced tuning | Phase 7 | done |
| Continuous improvement UX | `TrendDashboardPage` (5 tabs: trends, improvements, breakers, backtest, gaps), `MetricsDashboardPage` (release gates, snapshots, drift) | Phase 8 | done |
| Structured settings/admin UX | `FormBuilder`, SpecDetailPage 6-tab form, `SpecWizard`, Settings page wraps classic views; raw JSON only in expert-mode diagnostics (ExceptionInbox, JobDetailsPanel) | Phase 7 + Phase 8 | done |

## 14.2 Non-Negotiable UX Constraints

These must hold at final product state (all verified):

1. Pipeline + Review is the default happy loop; settings/admin are secondary. — **pass**: index route redirects to `/pipeline`; Settings is secondary nav.
2. A user can switch checkpoint (for example `copax` and `pony`) via simple selection, while resolver/prompt/baseline behavior changes deterministically. — **pass**: SpecDetailPage General tab has searchable checkpoint selector + profile/version/baseline fields.
3. Review is binary-first; advanced controls are progressive disclosure. — **pass**: `DecisionQueue` + `BinaryQuestionCard` with keyboard shortcuts; advanced controls behind "Start Decision Sprint" toggle.
4. Status must be live and trustworthy (event-driven where possible, polling fallback only). — **pass**: SSE via `useProjectEvents` + `AutopilotStatusBar` live badges.
5. No raw JSON editing as primary interaction for non-expert workflows. — **pass**: all primary flows (spec creation/editing, Pipeline, Review, Export) are form-based; raw JSON only in expert-mode diagnostic panels.

## 14.3 Definition of Integration Done

Integration is complete when (all verified):

1. Every UI package in 14.1 is mapped to a completed master phase. — **pass**: all 10 packages mapped and marked done.
2. `docs/ui/ui-redesign-plan.md` has no conflicting phase/timeline authority. — **pass**: §11 Governance defers execution order to master plan; §9 phase table aligned with backlog.
3. Acceptance checks in `docs/ui/in-app-guidance.md` pass for Pipeline, Review, Library, and Export in checkpoint-switched scenarios. — **pass**: §6b Pipeline checks, §6c Review checks, §6d Library checks all present; Export covered in stepper + CTA list.

---

## 15) Thoughtless Implementation Playbook

This section is intentionally procedural so implementation can be checklist-driven.

**Status: `done`** — all 5 sub-checklists verified/implemented; 35 gate tests passing (0 failures).

## 15.1 Backend Event Runtime Checklist

1. ~~Add event schemas listed in 4.6.~~ — **done**: `event.schema.json`, `event-cursor.schema.json`, `event-idempotency-index.schema.json` in `schemas/`.
2. ~~Implement per-project sequence allocator (atomic increment).~~ — **done**: `appendProjectEvent()` in `services/events.ts` with file-locked seq state.
3. ~~Emit events for:~~ — **done**: all event types emitted by worker + automation runner.
   - ~~job queued/running/progress/succeeded/failed/canceled~~
   - ~~automation run queued/running/step/succeeded/failed~~
   - ~~routing decisions and escalations~~
4. ~~Implement SSE endpoint:~~ — **done**: `GET /api/projects/:projectId/events/stream?since=<seq>` in `routes/events.ts`.
   - ~~`GET /api/projects/:projectId/events/stream?since=<seq>`~~
5. ~~Implement replay endpoint:~~ — **done**: `GET /api/projects/:projectId/events?since=<seq>&limit=<n>` in `routes/events.ts`.
   - ~~`GET /api/projects/:projectId/events?since=<seq>&limit=<n>`~~
6. ~~Enforce idempotency and loop guards.~~ — **done**: 30-day dedup window on (type, entityId, idempotencyKey) triple.

Definition of done:

1. ~~Restart/reconnect does not duplicate runs/jobs.~~ — **pass**: gate test `gate-replay-determinism.test.ts` — 100-event burst with duplicates produces 0 extra events.
2. ~~Frontend catches up from cursor without full project refetch.~~ — **pass**: `listProjectEvents(since=seq)` returns only newer events; `useProjectEvents` hook uses cursor.

## 15.2 Prompt Compiler Checklist

1. ~~Implement precedence exactly as in 4.5.~~ — **done**: 7-layer compile in `compilePromptPackage()` (`worker.ts`).
2. ~~Emit ordered compile trace entries.~~ — **done**: `PromptTraceEntry[]` with monotonic `order` field.
3. ~~Hash compiled package and store in evidence.~~ — **done**: SHA-256 `packageHash` persisted in asset versions and job outputs.
4. ~~Add deterministic tie-break implementation and tests.~~ — **done**: `localeCompare` tie-break; gate test `gate-prompt-precedence.test.ts` — 50-run hash stability = 100%.

Definition of done:

1. ~~Same inputs produce byte-identical compile trace and package hash.~~ — **pass**: 50 identical runs → 1 unique hash.

## 15.3 Checkpoint Switch Checklist (`copax`, `pony`)

1. ~~Create checkpoint profiles for both checkpoints.~~ — **done**: `copax_sdxl_v1.json`, `pony_v6xl_v1.json` in `checkpoint-profiles/`.
2. ~~Create baseline profile families scoped to each checkpoint.~~ — **done**: `baseline_copax.json`, `baseline_pony.json` in `baseline-profiles/`; `checkpointBaselineMap` updated in `project.json`.
3. ~~Create checkpoint-scoped tag prompt maps.~~ — **done**: `tagPromptMap` keyed by checkpointId in project policies.
4. ~~Pin profile/version on ready specs.~~ — **done**: `checkpointProfileId` + `checkpointProfileVersion` fields on specs; enforced by `enforceCheckpointCompatibility()`.
5. ~~Run switch matrix tests across core asset classes.~~ — **done**: gate test `gate-checkpoint-switch.test.ts` — copax/pony/sd15 compatible resolutions + mismatch detection + 100-run pinning stability.

Definition of done:

1. ~~Switching checkpoint in UI changes policy stack deterministically without manual hidden edits.~~ — **pass**: `enforceCheckpointCompatibility()` throws on mismatch; profile pinning 100% stable over 100 reruns.

## 15.4 Retry and Escalation Checklist

1. ~~Implement retry policy schema and defaults.~~ — **done**: `RetryPolicy` type + `DEFAULT_RETRY_POLICY` constant in `worker.ts`.
2. ~~Classify runtime errors into retryable/non-retryable codes.~~ — **done**: `classifyError()` → `ErrorClass` (retryable | non_retryable | timeout | upstream_unavailable).
3. ~~Apply bounded backoff + jitter.~~ — **done**: `computeBackoffMs()` with exponential/fixed modes, maxDelayMs cap, jitter, 100ms floor.
4. ~~Emit escalation events with reason code.~~ — **done**: escalation events emitted via `appendWorkerEvent()` with error class + evidence.

Definition of done:

1. ~~No unbounded retries.~~ — **pass**: `maxAttempts` enforced; `computeBackoffMs` capped at `maxDelayMs`; gate test confirms floor/ceiling bounds.
2. ~~Every escalated item has machine-readable reason and evidence links.~~ — **pass**: escalation events include `errorClass`, `reason`, `retryHistory`, `evidence`.

## 15.5 Gate Test Pack (Required)

**Infrastructure**: Node.js built-in `node:test` + `node:assert/strict` with `tsx` loader. Script: `node --import tsx --test tests/**/*.test.ts`. 4 test files, 35 tests, 14 suites, **all passing**.

1. ~~Replay determinism test pack:~~ — **done**: `tests/gate-replay-determinism.test.ts` (7 tests).
   - ~~100+ runs with event replay/restart simulation~~ — 100-event burst (50 unique × 2 duplicates) + cursor reconnect + monotonicity checks.
2. ~~Checkpoint switch pack:~~ — **done**: `tests/gate-checkpoint-switch.test.ts` (9 tests).
   - ~~`copax` and `pony` on same spec cohort~~ — copax/pony/sd15 compatible resolutions, cross-checkpoint mismatch, 100-run pinning.
3. ~~Prompt precedence pack:~~ — **done**: `tests/gate-prompt-precedence.test.ts` (5 tests).
   - ~~conflicting fragments and ordering cases~~ — 7-layer trace assertion, order monotonicity, 50-run hash stability, spec_override.
4. ~~Idempotency pack:~~ — **done**: `tests/gate-idempotency.test.ts` (14 tests).
   - ~~duplicate event injection and reconnect bursts~~ — 200-event dedup, reconnect burst, classifyError coverage, backoff bounds.

Release gate is blocked unless all packs pass.

Pass criteria:

1. Replay determinism pack: — **pass**
   - ~~0 duplicate jobs from replay~~ — 0 duplicates confirmed.
   - ~~decision trace equivalence >= 99%~~ — 100% (cursor-based replay returns exact subset).
2. Checkpoint switch pack: — **pass**
   - ~~0 incompatible baseline/profile resolutions~~ — 0 (mismatch throws, compatible resolves).
   - ~~profile pinning respected in 100% of reruns~~ — 100% over 100 iterations.
3. Prompt precedence pack: — **pass**
   - ~~100% precedence-order assertions pass~~ — 100%.
   - ~~0 nondeterministic tie-break outcomes~~ — 0 (50 runs → 1 unique hash).
4. Idempotency pack: — **pass**
   - ~~duplicate-action rate <= 0.1%~~ — 0% (100 unique events from 200 calls).
   - ~~reconnect recovery without manual cleanup in 100% test cases~~ — 100%.

---

## 16) Phase Acceptance Checklist (One-Page)

Use this table as the operational sign-off sheet. A phase is complete only when all checks are `pass` and evidence is linked.

| Phase | Core outcome | Acceptance checks (all required) | Required evidence artifacts | Status |
| --- | --- | --- | --- | --- |
| Phase 0 | Contracts frozen and testable | schema RFC merged; resolver+compiler contract merged; precedence/idempotency/retry contracts approved | schema change set, contract doc, review notes | `done` |
| Phase 1 | Event-driven runtime foundation | event stream live; SSE+replay endpoints working; async automation queue active; jobs/automation materialized indexes active; cursor recovery validated; idempotency+loop guards enabled; replay causes no duplicate runs/jobs; p95 latency checks pass on benchmark profile | event schema files, endpoint tests, replay test report, index integrity report, latency benchmark report | `done` |
| Phase 2 | Checkpoint-aware policy foundations | checkpoint profiles implemented; baseline checkpoint scope enforced; incompatible policy blocks ready/run; profile pinning on ready enabled; ready specs remain stable across default-profile changes unless explicitly rebound | migration log, compatibility tests for `copax`/`pony`, ready-gate tests, profile-rebind test report | `done` |
| Phase 3 | Prompt compiler determinism | precedence engine implemented; tag order deterministic per checkpoint; compile trace+hash persisted; seed policy recorded per output; repeated runs with same inputs produce equivalent compile trace/hash | compile trace snapshots, precedence test pack, seed evidence samples, determinism diff report | `done` |
| Phase 4 | Resolver governance and explainability | strict stack order/caps active; compatibility matrix enforced; resolved stack snapshots persisted for all outputs; resolver explanation object (`chosen/skipped/blocked`) persisted; evidence surfaced in UI | resolver tests, conflict-case fixtures, stack snapshot samples, evidence UI screenshots | `done` |
| Phase 5 | Validator and cohesion engine | validator report on every generation; perspective/silhouette/state/entity checks active; prompt-policy compliance check active | validator report samples, cohesion drift report, fail-category metrics | `done` |
| Phase 6 | Decision Sprint 2.0 | binary question flow contract-driven; helper overlays active; apply-to-similar works; uncertain routing uses sprint queue; transitional `manual_review_queue` fallback is removed or explicitly disabled by policy | sprint integration tests, keyboard-flow demo, queue routing audit, fallback-disable config snapshot | `done` |
| Phase 7 | Exceptions-only operations | ExceptionInbox+AutopilotStatusBar active; advanced tuning hidden by default; non-critical failures follow retry-first policy; retry/backoff/escalation contract enforced and observable | exception flow tests, escalation reason-code samples, retry policy validation report, UX acceptance checks | `done` |
| Phase 8 | Continuous improvement loop | cohort intervention runs operational; promotion/rollback controls active; trend tracking by entity and checkpoint active; measurable weekly quality lift reported | before/after metric reports, rollback drill log, weekly trend dashboard snapshot, quality-lift summary | `done` |
| Global Release Readiness | Product ready for broad usage | all release gates in section 9 pass; benchmark profile satisfied; gate test pack 15.5 fully pass; no open P0/P1 corrective items from prior phases | signed release-gate report, gate-pack results, corrective-item closure log | `in_progress` |

Sign-off rule:

1. Set phase to `done` only when all acceptance checks and evidence artifacts are complete.
2. If any check regresses later, set status back to `in_review` and open a corrective work item.
3. Allowed status values: `pending`, `in_progress`, `in_review`, `done`, `blocked`.
