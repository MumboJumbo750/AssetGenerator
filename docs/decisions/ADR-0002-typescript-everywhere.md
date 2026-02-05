# ADR-0002: TypeScript everywhere (Node.js)

Date: 2026-02-03

## Status

Accepted

## Context

We want a coherent stack across backend, frontend, and pipeline orchestration to:

- share types/schemas
- reduce context switching
- keep the data-first JSON contract consistent end-to-end

We also expect to integrate image tooling that is often Python-based.

## Decision

Use **Node.js + TypeScript** for:

- backend API
- frontend
- job orchestration/workers
- schema validation and file I/O

Python is allowed only as an **invoked tool** (optional) for specific image operations when no good Node alternative exists, but it must be wrapped behind the pipeline adapter interfaces.

## Consequences

- Shared types across FE/BE and less duplication.
- Pipeline code stays consistent; Python tools remain replaceable.
- We must be explicit about adapter boundaries and subprocess management when Python is used.
