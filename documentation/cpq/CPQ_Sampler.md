# CPQ Sampler Documentation

## Purpose
Systematically traverse CPQ option space, capture branch results, and persist snapshots for analysis and picture mapping.

## Modes
- `sampler`: branch-first sampling using per-branch StartConfiguration.
- `ui-hierarchical`: hierarchical traversal mode infrastructure (same capture model).

## Captured payload content
Each capture includes:
- traversal metadata (level/path/parent key)
- changed feature/option/value
- ruleset/namespace/header/detail/session identifiers
- selected options list
- IPN/price/description
- dropdown order snapshot
- signature for dedupe/traceability
- optional raw snippet

## Persistence
Captured records post to `/api/cpq/sampler-result` and insert into `CPQ_sampler_result`.

Top-level columns support filtering; full `json_result` preserves complete structure.

## Branch detail lineage
Sampler creates branch lineage with:
- new branch `detailId`
- `sourceDetailId` referencing base detail
- fresh StartConfiguration per branch before Configure call

This is the required pattern when independent detail identities are needed.

## Controls and limits
Sampler run is bounded by configurable limits:
- max depth
- max results
- max Configure calls
- max runtime minutes
- inter-call delay

Run control supports pause/stop semantics.
