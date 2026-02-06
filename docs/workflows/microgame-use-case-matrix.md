# Microgame Use-Case Hierarchy and Automation Matrix

Purpose: define the first simple game and the exact hierarchy needed to control generation automatically from specs.

> **Document status: PLANNING / ASPIRATIONAL**
>
> This document describes the _target_ control hierarchy and use-case matrix.
> Most of the infrastructure described here (H0-H10 nodes, validators,
> questionnaires, tag-model stack resolvers) is **not yet implemented**.
>
> **What exists today (Phase 11):**
>
> | Concept                                                                      | Status              | Location                                                         |
> | ---------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------- |
> | `entityLink` (`entityId` + `role`)                                           | **Implemented**     | `schemas/asset-spec.schema.json`                                 |
> | `seedPolicy` (fixed/derived/random_recorded)                                 | **Implemented**     | `schemas/asset-spec.schema.json`                                 |
> | `checkpointProfileVersion`                                                   | **Implemented**     | `schemas/asset-spec.schema.json`                                 |
> | `qualityContract` (background, states, alignment, perspective, silhouette)   | **Implemented**     | `schemas/asset-spec.schema.json`                                 |
> | `styleConsistency` (mode, anchorRefs)                                        | **Implemented**     | `schemas/asset-spec.schema.json`                                 |
> | Prompt compile trace (7-layer)                                               | **Implemented**     | `apps/worker/src/worker.ts`, `schemas/compile-trace.schema.json` |
> | Automation rules + runs                                                      | **Implemented**     | `schemas/automation-rule.schema.json`, worker                    |
> | Retry / escalation (retryable, non_retryable, timeout, upstream_unavailable) | **Implemented**     | `apps/worker/src/worker.ts`                                      |
> | Circuit breaker                                                              | **Schema only**     | `schemas/circuit-breaker.schema.json`                            |
> | H0-H10 hierarchy nodes                                                       | **Not implemented** | —                                                                |
> | `appProfileId`, `capabilityId`, `useCaseFamilyId`                            | **Not implemented** | —                                                                |
> | `artifactSetId`, `stateGroupId`, `effectChainId`, `anchorSetId`              | **Not implemented** | —                                                                |
> | Validators / questionnaires                                                  | **Not implemented** | —                                                                |
> | Tag → model stack resolver                                                   | **Not implemented** | —                                                                |
>
> When implementing items from this plan, update the status table above.

This document is the bridge between:

- `docs/ui/happy-loop-implementation-backlog.md` (master strategy)
- `docs/workflows/spec-recreation-happy-loop.md` (authoring workflow)

---

## 1) First Reference App (Small, High-Coverage)

App ID: `microgame_shape_shooter_v1`

Design constraints:

1. Minimal art complexity: simple forms, small images.
2. Maximum consistency pressure: perspective, icon/state continuity, item identity continuity.
3. Fast iteration: small asset set with strong cross-links.

Gameplay loop:

1. Player ship moves and shoots.
2. Two enemy shapes spawn.
3. Weapon and armor pickups drop.
4. Pickup changes player loadout visuals.
5. UI buttons and HUD icons reflect current state.

Asset classes covered:

1. World sprites
2. Animation strips
3. Pickup icons
4. Inventory/HUD icons
5. UI state packs
6. Projectile-impact-explosion VFX chain

---

## 2) Control Hierarchy (Spec-Driven)

Hierarchy IDs are mandatory. Automation must fail fast if required links are missing.

## H0 App Profile

- ID: `appProfileId`
- Owns default checkpoint, default baseline stack, default routing thresholds.
- One per microgame project.

## H1 Capability

- ID: `capabilityId`
- Examples: `combat`, `loot`, `ui`, `vfx`.
- Groups families sharing validators/questionnaires.

## H2 Use-Case Family

- ID: `useCaseFamilyId`
- Examples: `entity_identity`, `ui_state_consistency`, `perspective_lock`, `effect_chain`.
- Defines required tag classes and required link IDs.

## H3 Artifact Set

- ID: `artifactSetId`
- Cohesion boundary for outputs that must look like one family.
- Examples:
  - `weapon_laser_mk1_set` = world sprite + animation + pickup + inventory icon
  - `btn_primary_set` = default/hover/pressed/disabled

## H4 Entity

- ID: `entityId`
- Stable identity across formats and contexts.
- Required for weapons/armor/characters/items.

## H5 Role

- Field: `role`
- Examples: `world_sprite`, `animation_frame`, `pickup_icon`, `inventory_icon`, `ui_button_state`, `vfx_frame`.

## H6 Spec Node

- ID: `specId`
- Single generative unit with explicit quality contract and model policy.
- Must reference `artifactSetId` and usually `entityId`.

## H7 Model Policy Node

- Field group: `modelStackPolicyRef`
- Resolver input: checkpoint -> baseline stack -> project stack -> tag/entity stack.

## H8 Validation Node

- Field group: `validationContractRef`
- Defines validator set and thresholds.

## H9 Questionnaire Node

- Field group: `questionSetId`
- Generated from validation + tags, not handwritten per asset.

## H10 Routing Node

- Output field: `routingOutcome`
- One of `auto_advance`, `auto_regenerate`, `decision_sprint`, `exception`.

---

## 3) Relationship Matrix (What Controls What)

| Source level       | Controls                       | Mechanism              | Deterministic rule                             |
| ------------------ | ------------------------------ | ---------------------- | ---------------------------------------------- |
| H0 App Profile     | global defaults                | profile policy         | applies when lower levels do not override      |
| H1 Capability      | family guardrails              | capability config      | merged with H0 using fixed precedence          |
| H2 Use-Case Family | required tags/links/validators | family contract        | missing required fields blocks ready status    |
| H3 Artifact Set    | cross-output cohesion boundary | shared IDs + anchors   | all members evaluated for drift together       |
| H4 Entity          | identity continuity            | shared `entityId`      | icon/world/animation must map to same identity |
| H6 Spec Node       | generation intent              | explicit spec contract | no implicit role inference allowed             |
| H7 Model Policy    | model stack selection          | resolver               | fixed stack order and bounds                   |
| H8 Validation Node | pass/fail signals              | validator execution    | hard-rule fail cannot auto-advance             |
| H9 Questionnaire   | human fallback questions       | generated question set | only shown for uncertain/mixed evidence        |
| H10 Routing Node   | pipeline progression           | routing engine         | outcome must include evidence refs             |

---

## 4) Minimum Tag Taxonomy (Operational, Not Decorative)

Required groups:

1. `domain:*`
2. `role:*`
3. `entity:*` (except environment-only assets)
4. `state:*` (for stateful UI or animation packs)
5. `perspective:*`
6. `style:*`
7. `contract:*`
8. `quality:*`

Mandatory tagging rule:

1. Every spec needs one `domain:*`, one `role:*`, and one `perspective:*`.
2. Every identity-bearing spec needs one `entity:*`.
3. `contract:*` tags must map to validators or questionnaire prompts.

---

## 5) Use-Case Catalog for Microgame v1

| UC_ID  | Family                | Scope                       | Required links                   | Primary risk handled          |
| ------ | --------------------- | --------------------------- | -------------------------------- | ----------------------------- |
| UC-001 | entity_identity       | weapon world sprite         | `entityId`, `artifactSetId`      | weapon form drift             |
| UC-002 | entity_identity       | weapon pickup icon          | `entityId`, `artifactSetId`      | icon mismatch vs world item   |
| UC-003 | entity_identity       | weapon inventory icon       | `entityId`, `artifactSetId`      | HUD mismatch vs pickup        |
| UC-004 | entity_identity       | armor world+pickup+icon     | `entityId`, `artifactSetId`      | armor continuity break        |
| UC-005 | ui_state_consistency  | primary button states       | `stateGroupId`, `artifactSetId`  | state shape/position drift    |
| UC-006 | perspective_lock      | all world assets            | `artifactSetId`                  | camera angle inconsistency    |
| UC-007 | effect_chain          | projectile-impact-explosion | `effectChainId`, `artifactSetId` | chain style mismatch          |
| UC-008 | animation_consistency | entity animation strip      | `entityId`, `artifactSetId`      | frame-to-frame identity drift |
| UC-009 | export_gate           | atlas-ready groups          | family IDs above                 | incomplete packs exported     |
| UC-010 | confidence_guard      | any generated output        | any                              | weak evidence auto-shipped    |

---

## 6) Decision Matrix (Automation Runtime Contract)

| UC_ID  | Required tags                                      | Model stack profile             | Validators                           | Questionnaire                     | Route logic                                  |
| ------ | -------------------------------------------------- | ------------------------------- | ------------------------------------ | --------------------------------- | -------------------------------------------- | ------------------ | ---------------------------------------- |
| UC-001 | `domain:weapon`, `role:world_sprite`, `entity:*`   | baseline + project              | perspective, silhouette              | `q.identity.same_family`          | pass=advance fail=regen uncertain=sprint     |
| UC-002 | `domain:weapon`, `role:pickup_icon`, `entity:*`    | baseline + project + entity     | silhouette, readability_small        | `q.identity.pickup_matches_world` | pass=advance fail=regen uncertain=sprint     |
| UC-003 | `domain:weapon`, `role:inventory_icon`, `entity:*` | baseline + project + entity     | silhouette, readability_small        | `q.identity.icon_matches_pickup`  | pass=advance fail=regen uncertain=sprint     |
| UC-004 | `domain:armor`, `entity:*`                         | baseline + project + entity     | silhouette, perspective              | `q.identity.armor_consistent`     | pass=advance fail=regen uncertain=sprint     |
| UC-005 | `domain:ui`, `role:ui_button_state`, `state:*`     | baseline + project              | state_completeness, alignment        | `q.ui.states_complete_aligned`    | pass=advance fail=regen uncertain=sprint     |
| UC-006 | `perspective:*`, `role:world_sprite`               | baseline(perspective) + project | perspective_lock                     | `q.perspective.consistent`        | pass=advance fail=regen uncertain=sprint     |
| UC-007 | `domain:vfx`, `role:projectile                     | impact                          | explosion`                           | baseline + project + tag          | palette_cohesion, sequence_cohesion          | `q.vfx.same_chain` | pass=advance fail=regen uncertain=sprint |
| UC-008 | `role:animation_frame`, `entity:*`                 | baseline + project + entity     | temporal_alignment, silhouette_drift | `q.animation.identity_stable`     | pass=advance fail=regen uncertain=sprint     |
| UC-009 | `contract:export_required`                         | inherited from group            | pack_completeness                    | `q.export.safe_to_ship`           | pass=advance fail=exception uncertain=sprint |
| UC-010 | any                                                | any                             | confidence_aggregator                | `q.routing.need_human`            | high=advance low=sprint/exception            |

---

## 7) Spec Schema Additions Required for This Matrix

Each spec must support:

1. `appProfileId` — **not yet in schema**
2. `capabilityId` — **not yet in schema**
3. `useCaseFamilyId` — **not yet in schema**
4. `artifactSetId` — **not yet in schema**
5. `entityLink.entityId` — **implemented** (`schemas/asset-spec.schema.json`)
6. `entityLink.role` — **implemented** (`schemas/asset-spec.schema.json`, values: animation, pickup_icon, portrait, ui_card)
7. `stateGroupId` (optional by family) — **not yet in schema**
8. `effectChainId` (optional by family) — **not yet in schema**
9. `anchorSetId` (optional but recommended) — **not yet in schema**
10. `questionSetId` (derived, persisted on run) — **not yet in schema**

Readiness gate:

1. Any missing required ID for matched `UC_ID` blocks `status=ready`.
2. UI should show exact missing fields and affected `UC_ID`s.

---

## 8) First Build Slice (Deterministic MVP)

Implement in order:

1. UC-001, UC-002, UC-003 (weapon identity chain)
2. UC-005 (button state pack consistency)
3. UC-006 (perspective lock)
4. UC-010 (confidence guard)

Exit criteria:

1. Every generated output maps to at least one `UC_ID`.
2. Routes include evidence references (`validatorId`, score, thresholds, reason).
3. Decision Sprint only receives uncertain cases.

---

## 9) Connection to Questionnaire and Tag->Model Maps

Question generation rule:

1. Resolve applicable `UC_ID`s from tags + role + IDs.
2. Build question list from matrix `Questionnaire` keys.
3. Attach helper overlays based on validator type.

Model stack rule:

1. Resolve baseline stack from app/profile.
2. Resolve project stack from project defaults.
3. Resolve tag/entity stack from `tagModelMap` and `entityPolicy`.
4. Validate compatibility matrix before execution.

---

## 10) Definition of Done (Planning Phase)

Planning is complete when:

1. All microgame specs can be classified into H0..H10.
2. Every class in scope has at least one `UC_ID`.
3. Required IDs and tag groups are documented and enforceable.
4. The first build slice is explicitly sequenced for implementation.

---

## 11) Relationship to Current Codebase

The current spec schema (`schemas/asset-spec.schema.json`) supports a subset of this matrix:

- `entityLink` (entityId + role) — covers H4/H5 identity and role binding.
- `seedPolicy` — reproducibility control not envisioned in the original matrix but complementary.
- `qualityContract` — partially maps to H8 validation contracts.
- `styleConsistency` — partially maps to H3 cohesion boundaries.
- `promptPolicy` (compile trace) — provides the deterministic prompt assembly that H7 model policy depends on.

The remaining hierarchy nodes (H0 App Profile through H10 Routing) and the validator/questionnaire infrastructure are future work items that should be implemented incrementally.
