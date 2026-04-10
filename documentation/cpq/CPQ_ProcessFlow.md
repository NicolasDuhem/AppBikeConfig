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

High-level behavior:
1. Start from active state.
2. Iterate traversable features/options.
3. For each change, call Configure.
4. Save result snapshot (session, detail, selected options, ipn, price, traversal metadata).

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
