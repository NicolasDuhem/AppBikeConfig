# CPQ Process Flow

## 1) StartConfiguration flow

1. User selects account + ruleset in `/bike-builder`.
2. UI builds init request with:
   - `ruleset`, `partName`, `namespace`, `headerId`, `detailId`
   - `context` from selected account row.
3. `/api/cpq/init` builds CPQ StartConfiguration body.
4. `lib/cpq/client.startConfiguration()` POSTs to `{CPQ_BASE_URL}/StartConfiguration`.
5. Response is normalized via `mapCpqToNormalizedState()`.
6. UI state is replaced with returned normalized state.

## 2) Configure flow

1. User changes one dropdown option.
2. UI resolves selected option and sends `/api/cpq/configure` with:
   - current `sessionId`
   - `featureId`
   - changed option value (`optionValue`)
3. Server calls `configureConfiguration()` with minimal payload:

```json
{
  "sessionID": "<full-session-id>",
  "selections": [
    { "id": "<feature-id>", "value": "<option-value>" }
  ]
}
```

4. CPQ response is normalized.
5. UI **replaces** feature state using latest response (no stale merge).

## 3) Dropdown interaction + selected option persistence

Selection persistence rules:
- Parent feature current value is read from `ScreenOption.Value` (or equivalent aliases).
- Option is considered selected when `option.value === currentValue`.
- If no exact match exists, fallback to first visible/enabled option.

This prevents reset/snap-back behavior after configure calls.

## 4) IPN update flow

After each Start/Configure response:
1. Parser scans payload for IPN patterns (direct or nested).
2. Extracted IPN is placed into normalized state `ipnCode`.
3. UI summary and captured traversal results use this value.

## 5) Traversal / sampler flow

Two runtime modes exist in bike-builder:
- sampler
- UI-hierarchical traversal

Shared principle:
- traversal uses the same configure API flow as manual selection.

Sampler mode (fresh branch per sampled variant):
1. Start from active seed state and keep a seed context record:
   - `baseDetailId`, `baseSessionId`
   - selected ruleset/namespace/header
   - account context values.
2. For each sampled option branch:
   - generate a new branch detail GUID (`branchDetailId`)
   - call StartConfiguration again with:
     - `headerDetail.detailId = branchDetailId`
     - `sourceHeaderDetail.detailId = baseDetailId` (or branch parent detail when chaining)
   - this creates a fresh CPQ detail/session context for that sample.
3. Run Configure only after branch StartConfiguration to apply option changes.
4. Save sampled result with:
   - `baseDetailId`
   - `sourceDetailId`
   - `branchDetailId` (also stored as row `detail_id`)
   - branch `sessionId`
   - selected options/IPN/raw JSON snapshot.

Why this is required:
- Configure is session-driven and does not accept a detailId in payload.
- New detail contexts are established through StartConfiguration.
- Configure-only branching keeps results in one long-running session/detail chain.

UI-hierarchical traversal branch behavior:
1. Fresh StartConfiguration per branch root.
2. Replay prefix path via Configure calls.
3. Apply next feature option.
4. Continue depth-first within configured limits.

## 6) Account + ruleset selection flow

1. Bike-builder loads active setup rows from both setup APIs.
2. First active account/ruleset pre-populates controls.
3. Account change updates context fields used in CPQ calls.
4. Ruleset change triggers a fresh StartConfiguration.
