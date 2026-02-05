# Collaboration: conflict minimization

## Why conflicts happen

Our DB is JSON under `data/`. Two people editing the same asset/spec/job file can conflict on merge.

## Recommended habits

- Prefer **additive changes** (new assets/specs) over edits to the same record.
- Avoid editing the same asset version in parallel.
- Keep tags consistent with catalogs to reduce churn.

## Practical strategies

- **Shard work by project** or by assetType when possible.
- If a review pass is needed, **claim a batch** and finish before moving to the next.
- Use **SpecLists** for collaboration: merge the list, then refine once.

## When conflicts hit

- For JSON conflicts, prefer the most recent `updatedAt`.
- For assets, prefer keeping **all** versions and removing duplicates after.
- Run `npm run validate:data` after resolving.

## If conflicts become frequent

Consider refactoring assets to **one version per file** or introducing a review lock.
