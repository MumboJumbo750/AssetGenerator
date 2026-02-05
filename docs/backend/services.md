# Backend services (architecture)

This document defines how the backend **service layer** is structured and how to extend it.

## Purpose

Services contain **domain logic** and **file IO** for the data-first JSON DB. Routes should stay thin and delegate to services.

## Directory layout

`apps/backend/src/services/*`

## Current services

- `projects.ts`: project CRUD + catalog defaults
- `specLists.ts`: SpecList CRUD
- `specs.ts`: AssetSpec list + create
- `assets.ts`: asset read/update helpers
- `jobs.ts`: job list + create
- `catalogs.ts`: catalog read/write helpers
- `systemStatus.ts`: system status snapshot
- `comfyuiVerify.ts`: ComfyUI verification + manifest checks
- `automation.ts`: workflow automation rules + runs

## Rules of thumb

- **Validate writes**: services must validate against schemas before persisting.
- **No HTTP in services** except external probes (ComfyUI verify).
- **Return null** for not-found to let routes decide HTTP status codes.
- **Keep routes thin**: parameter parsing + error codes only.
- **Prefer explicit types** exported from services when reused in routes.

## Adding a new service

1. Create `apps/backend/src/services/<domain>.ts`
2. Export functions and types.
3. Wire routes to the service.
4. Update `apps/backend/src/services/index.ts` to re-export the new service.

## Example pattern

```
export async function listThings(root: string) { ... }
export async function createThing(opts: { root: string; schemas: SchemaRegistry; ... }) { ... }
```
