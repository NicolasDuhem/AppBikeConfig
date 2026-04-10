# CPQ Known Issues and Pitfalls

## 1) Wrong endpoint usage

Invalid pattern:
- Mingle/ION-style endpoints for configurator UI calls.

Working pattern:
- Direct ProductConfiguratorUI JSON service:
  - `.../ProductConfiguratorUI.svc/json/StartConfiguration`
  - `.../ProductConfiguratorUI.svc/json/configure`

## 2) Wrong base URL composition

Pitfall:
- Storing `CPQ_BASE_URL` with `/StartConfiguration` included.

Consequence:
- doubled path like `/StartConfiguration/StartConfiguration`.

Correct:
- `CPQ_BASE_URL` must end at `/json` service root only.

## 3) Session ID trimming (INVALID)

Invalid behavior (removed):
- splitting session id on `~`
- using only trailing segment
- debug toggle to trim before Configure

Correct behavior:
- pass full session ID exactly as returned by CPQ.

Example valid full session:
- `BROMPTON_TRN~BROMPTON_TRN~5fad26cc-c3cb-484b-a087-5b21d6239b4a`

## 4) Incorrect configure payload shape

Pitfalls:
- sending entire config state back
- sending synthetic/over-specified structures
- multi-change payloads for simple dropdown actions

Correct baseline:
- one changed selection with `id` + `value`.

## 5) Wrong selected-option reconstruction

Pitfall:
- selecting by wrong identity or first option too eagerly.

Consequence:
- dropdown snaps back to old/default/first value.

Correct:
- determine selected option by matching feature current value to option value.
- fallback only when exact match missing.

## 6) Duplicate feature parsing

Pitfall:
- collecting repeated feature candidates without stable dedupe.

Consequence:
- duplicate dropdowns and inconsistent UI state.

Correct dedupe priority:
1. `CustomProperties.FeatureID`
2. `ScreenOption.Name`
3. `ScreenOption.ID`

Tie-breakers:
- visible > hidden
- richer option list > poorer
- earliest candidate as final tie-breaker

## 7) Deployment/type issues

Observed pattern:
- build failures caused by TypeScript signature mismatches (compile-time), not CPQ credentials.

Practical guidance:
- treat Vercel type-check failures as code defects first.
- verify route/helper signatures whenever smoke/helper APIs change.
