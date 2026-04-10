# CPQ Process Flow

## Scope
End-to-end runtime flow for CPQ bike builder:
- initialization
- option change
- persistence
- sampler traversal/branching
- picture sync
- layered rendering

---

## 1) Initialization Flow (`StartConfiguration`)

1. UI loads active account context and active rulesets from setup APIs.
2. User (or default selections) determines:
   - ruleset/partName,
   - namespace,
   - headerId,
   - account context (account/customer/currency/language/country),
   - generated `detailId`.
3. `POST /api/cpq/init` is called.
4. Route builds StartConfiguration payload and calls CPQ.
5. CPQ response is normalized to `NormalizedBikeBuilderState`.
6. UI renders deduped visible features as dropdowns.

Result artifacts:
- `sessionId`
- parsed feature/options
- IPN / price / debug metadata

---

## 2) Manual Dropdown Change Flow (`Configure`)

For one dropdown change:

1. UI determines selected option’s `optionValue` from selected `optionId`.
2. `POST /api/cpq/configure` sends:
   - same active `sessionId`,
   - `featureId`,
   - selected `optionValue`.
3. Server sends CPQ Configure payload with exactly one selection:
   - `id = featureId`
   - `value = optionValue`
4. CPQ response normalized; UI state replaced with returned state.
5. Selected option persists via value matching (`currentValue` vs option value).

Important: Configure updates one active session; it does not mint a new detail identity.

---

## 3) Session Rule

`sessionId` is treated as opaque and passed unchanged.

No trimming/shortening is permitted.

---

## 4) Parsing and UI Selection Rule

Parser walks:
`Pages -> Screens -> ScreenOptions -> SelectableValues`.

For each feature:
- selected option is matched where `ScreenOption.Value === SelectableValue.Value`.
- fallback is first visible+enabled option if no exact match.

Feature dedupe prevents duplicate dropdown rendering.

---

## 5) IPN Flow

IPN extraction runs during normalization.

Main path:
- detect caption/name/label equivalent to `IPN Code`,
- use associated `Value`.

IPN is shown in summary panel and captured during sampler/manual save persistence.

---

## 6) Manual “Save Configuration” Flow

Button: **Save Configuration** in bike-builder summary panel.

Flow:
1. Capture current normalized state into `CapturedConfiguration`.
2. Tag capture with `source: "manual-save"`.
3. POST to `/api/cpq/sampler-result`.
4. Persist to `CPQ_sampler_result` with context + JSON payload.

This allows saving current interactive configuration without running traversal.

---

## 7) Sampler / Traversal Flow

### Current branch strategy
Sampler uses **per-branch StartConfiguration + Configure**:

1. Create/retain a base seed context.
2. For each branch path/option:
   - generate a **new** `detailId` (branch detail),
   - call StartConfiguration with:
     - `headerDetail.detailId = branch detailId`
     - `sourceHeaderDetail.detailId = base detailId`
   - call Configure to apply branch option change,
   - capture/persist result.

### Why this design
- Configure is session-based and has no field to create new detail IDs.
- New detail lineage is introduced via StartConfiguration header/source detail structure.

---

## 8) Picture Management Sync Flow

Purpose: feed image management rows from persisted sampler/manual results.

1. Run `/api/cpq/setup/picture-management/sync`.
2. Service reads unprocessed sampler rows.
3. Parse `json_result.selectedOptions[]`.
4. Distinct identity uses:
   - `featureLabel`
   - `optionLabel`
   - `optionValue`
5. Insert missing rows into `cpq_image_management`.
6. Mark sampler rows processed (`processed_for_image_sync = true`, timestamp set).

---

## 9) Image Rendering Flow (Layered PNG)

On state/session changes in bike-builder:

1. Build selected options list from current features.
2. POST to `/api/cpq/image-layers`.
3. Resolve matching `cpq_image_management` row per selection.
4. Collect non-empty `picture_link_1..4`.
5. Render all returned links as stacked transparent PNG layers in top-right preview.

Layer order:
- slot 1 = bottom
- slot 4 = top

---

## 10) State/Persistence Relationships

| Flow | Detail ID behavior | Session behavior | Persistence |
|---|---|---|---|
| Manual init | new detailId generated in UI | new session returned | no auto-save |
| Manual configure | unchanged detail context | same active session | no auto-save |
| Manual save | uses current active detail/session | current session | inserts `CPQ_sampler_result` |
| Sampler branch | new branch detailId per branch start | new session per branch start | inserts `CPQ_sampler_result` |

---

## 11) Practical Debug Checks

When validating flow correctness, check these invariants:
1. Configure request contains exactly one `selections[]` element.
2. Configure request `sessionID` equals session shown by UI.
3. Returned feature current value matches requested option value (or expected CPQ constraint output).
4. Dedupe counts are stable (`rawFeatureCount` >= `dedupedFeatureCount` >= `visibleFeatureCount`).
5. Sampler rows transition from unprocessed to processed after sync.
