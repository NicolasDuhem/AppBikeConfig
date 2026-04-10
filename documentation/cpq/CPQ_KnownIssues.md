# CPQ Known Issues and Lessons Learned

## Scope
Historical pitfalls and current guardrails for AppBikeConfig CPQ implementation.

---

## 1) Wrong Endpoint / Wrong Base URL

### Symptom
- auth challenges / route failures / non-functional StartConfiguration.

### Root cause
- using non-service CPQ path style (e.g., ION/Mingle patterns), or malformed base URL.

### Correct rule
Use direct CPQ service base:

```text
https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json
```

Then append:
- `/StartConfiguration`
- `/configure`

Do not store `/StartConfiguration` inside `CPQ_BASE_URL`.

---

## 2) Wrong Configure Payload Shape

### Symptom
- option changes reset or behave unpredictably.

### Root cause
- sending full selection sets, guessed blocks, or wrong field semantics.

### Correct rule
Configure payload must be:
- `sessionID`
- `selections` array containing exactly one changed item
- `id = feature id`
- `value = selected option value`

---

## 3) Session Trimming Is Invalid

### Symptom
- Configure fails or state diverges.

### Root cause
- trimming/splitting/reconstructing CPQ session string.

### Correct rule
Use session ID exactly as returned by CPQ.

---

## 4) Selected Option Reset / Snapback

### Symptom
- UI reverts to first/default option after Configure.

### Root cause
- incorrect selected-option matching logic.

### Correct rule
Match selected option by:

```text
ScreenOption.Value === SelectableValue.Value
```

Only fallback to first visible+enabled if no match exists.

---

## 5) Duplicate Features in UI

### Symptom
- repeated dropdowns for same logical feature.

### Root cause
- flat parsing without stable dedupe key and candidate scoring.

### Correct rule
Dedupe by stable key priority:
1. `FeatureID`
2. `ScreenOption.Name`
3. `ScreenOption.ID`

Favor visible/richer candidates.

---

## 6) Configure Does Not Create New Detail IDs

### Symptom
- expecting independent branch detail IDs from Configure-only traversal.

### Root cause
- misunderstanding CPQ session behavior.

### Correct rule
To get branch detail lineage:
- call StartConfiguration with new `headerDetail.detailId`,
- pass source via `sourceHeaderDetail.detailId`,
- then Configure branch selections.

---

## 7) Picture Management Identity Mistake

### Symptom
- excessive duplicate picture mapping rows.

### Root cause
- identity based on `feature_id` / `option_id` instead of business-stable labels/values.

### Correct rule
Use unique identity:
- `feature_label`
- `option_label`
- `option_value`

---

## 8) Picture Sync Scalability

### Symptom
- sync cost grows over time when all sampler rows are rescanned.

### Fix
Use incremental markers on sampler rows:
- `processed_for_image_sync`
- `processed_for_image_sync_at`

Sync reads only unprocessed rows and marks processed rows after handling.

---

## 9) Vercel/Deployment Confusion

### Symptom
- deploy failures incorrectly attributed to env settings.

### Root cause
- TypeScript signature/type mismatches in code.

### Lesson
Always check build/type diagnostics first; not every deployment issue is a CPQ credential/config issue.

---

## 10) Practical Debug Checklist

When diagnosing CPQ runtime issues, verify in this order:
1. `CPQ_BASE_URL` and endpoint composition.
2. `Authorization: ApiKey <raw_key>` formatting.
3. StartConfiguration payload part/header/context values.
4. Configure payload (one changed selection only).
5. sessionID unchanged between response and next request.
6. selected-option matching + dedupe parser behavior.
7. image sync flags and mapping existence for preview layers.
