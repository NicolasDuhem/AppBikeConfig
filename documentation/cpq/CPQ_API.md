# CPQ API Integration (AppBikeConfig)

## Scope
This document describes the **implemented** CPQ API behavior in AppBikeConfig (Next.js routes + CPQ client), including endpoint construction, auth, payload shapes, response parsing, and common failure modes.

Primary implementation files:
- `lib/cpq/config.ts`
- `lib/cpq/client.ts`
- `lib/cpq/mappers.ts`
- `app/api/cpq/init/route.ts`
- `app/api/cpq/configure/route.ts`
- `app/api/cpq/smoke/route.ts`

---

## 1) CPQ Base URL and Endpoints

### Base URL (service root)
Configured via `CPQ_BASE_URL` and normalized without trailing slash.

Default/fallback in code:

```text
https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json
```

### Endpoint paths used
- **StartConfiguration**: `POST {CPQ_BASE_URL}/StartConfiguration`
- **Configure**: `POST {CPQ_BASE_URL}/configure` (lowercase)

Important:
- `CPQ_BASE_URL` must be the service root (must **not** include `/StartConfiguration`).
- Configure path is currently called with lowercase `configure`.

---

## 2) Authentication Header Format

Implemented header format:

```http
Authorization: ApiKey <raw_key>
Content-Type: application/json
Accept: application/json
```

`CPQ_API_KEY` stores the **raw key only**. The code prepends `ApiKey ` at request time.

---

## 3) StartConfiguration Payload Shape (Correct/Implemented)

`buildStartConfigurationPayload()` is the source of truth.

```json
{
  "inputParameters": {
    "mode": 0,
    "profile": "Default",
    "variantKey": null,
    "application": {
      "instance": "BROMPTON_TRN",
      "name": "BROMPTON_TRN"
    },
    "part": {
      "namespace": "Default",
      "name": "BBLV6_G-LineMY26"
    },
    "headerDetail": {
      "headerId": "Simulator",
      "detailId": "<detail-guid>"
    },
    "sourceHeaderDetail": {
      "headerId": "",
      "detailId": ""
    },
    "integrationParameters": [
      { "name": "AccountType", "simpleValue": "Dealer", "isNull": false, "type": "string" },
      { "name": "CurrencyCode", "simpleValue": "GBP", "isNull": false, "type": "string" },
      { "name": "Company", "simpleValue": "A000286", "isNull": false, "type": "string" },
      { "name": "AccountCode", "simpleValue": "A000286", "isNull": false, "type": "string" },
      { "name": "CustomerId", "simpleValue": "<optional>", "isNull": false, "type": "string" },
      { "name": "LanguageCode", "simpleValue": "<optional>", "isNull": false, "type": "string" },
      { "name": "CustomerLocation", "simpleValue": "GB", "isNull": false, "type": "string" }
    ],
    "rapidOptions": null
  }
}
```

Notes:
- `CustomerId` and `LanguageCode` are included only when present.
- `CustomerLocation` comes from `countryCode` context or CPQ default.

---

## 4) Configure Payload Shape (Correct/Implemented)

The route/client intentionally sends exactly one changed selection:

```json
{
  "sessionID": "<full-session-id>",
  "selections": [
    {
      "id": "<feature-id>",
      "value": "<selected-option-value>"
    }
  ]
}
```

Rules:
- Send `sessionID`.
- Send one changed selection only.
- `id` = **feature id**.
- `value` = **option value**.
- Do not send all selected options or speculative blocks.

---

## 5) Session ID Handling (Critical)

`sessionId` must be used **exactly as returned by CPQ**.

Do **not**:
- trim,
- split,
- shorten,
- parse and rebuild.

Historical trim experiments are invalid and not part of current behavior.

---

## 6) Response Parsing Structure

Normalization walks CPQ response structures using these canonical levels:

1. `Pages[]`
2. `Screens[]`
3. `ScreenOptions[]`
4. `SelectableValues[]`

`mapCpqToNormalizedState()` maps each `ScreenOption` to a feature and each `SelectableValue` to an option.

---

## 7) Selected Option Matching Rule

Implemented selected-option matching is:

```text
ScreenOption.Value === SelectableValue.Value
```

Behavior:
1. exact direct value match
2. normalized value match fallback (case/trim)
3. if no match: first visible+enabled option fallback

This prevents option reset/snapback after Configure.

---

## 8) IPN Code Extraction and Display

IPN extraction is defensive and includes caption/value scanning. Key rule:
- Find a detail-like record where caption/name/label resolves to `IPN Code`, then read `Value`.

IPN is surfaced in normalized state (`ipnCode`) and displayed in bike-builder summary/debug.

---

## 9) Feature Dedupe Logic

Duplicate feature rows are deduped using stable key priority:
1. `FeatureID` (from custom properties)
2. `ScreenOption.Name`
3. `ScreenOption.ID`

Scoring favors visible candidates and richer option sets.

---

## 10) Runtime API Routes in App

| Route | Method | Purpose |
|---|---|---|
| `/api/cpq/init` | POST | StartConfiguration call + normalization |
| `/api/cpq/configure` | POST | Configure one selection + normalization |
| `/api/cpq/smoke` | POST | Start smoke diagnostics (request/response/config debug) |
| `/api/cpq/sampler-result` | POST | Persist sampled/manual capture |
| `/api/cpq/image-layers` | POST | Resolve layered PNG links for selected options |

### `/api/cpq/init` request example
```json
{
  "ruleset": "BBLV6_G-LineMY26",
  "partName": "BBLV6_G-LineMY26",
  "namespace": "Default",
  "headerId": "Simulator",
  "detailId": "f29b30e3-2f53-4a09-8fc4-a08b1d7f8f95",
  "sourceHeaderId": "",
  "sourceDetailId": "",
  "context": {
    "accountCode": "A000286",
    "customerId": "C12345",
    "currency": "GBP",
    "language": "en-GB",
    "countryCode": "GB"
  }
}
```

### `/api/cpq/configure` request example
```json
{
  "sessionId": "BROMPTON_TRN~BROMPTON_TRN~5fad26cc-c3cb-484b-a087-5b21d6239b4a",
  "ruleset": "BBLV6_G-LineMY26",
  "featureId": "WheelType",
  "optionId": "local-ui-stable-id",
  "optionValue": "Rolling 16 inch",
  "context": {
    "accountCode": "A000286",
    "customerId": "C12345",
    "currency": "GBP",
    "language": "en-GB",
    "countryCode": "GB"
  }
}
```

`optionId` is UI-local convenience. CPQ payload uses `featureId + optionValue`.

---

## 11) Environment Variables (Integration Layer)

Core integration env vars:
- `CPQ_API_KEY` (required)
- `CPQ_BASE_URL`
- `CPQ_INSTANCE`
- `CPQ_PROFILE`

Additional defaults still supported in config builder:
- `CPQ_NAMESPACE`, `CPQ_PART_NAME`, `CPQ_ACCOUNT_TYPE`, `CPQ_CURRENCY`, `CPQ_COMPANY`, `CPQ_CUSTOMER_LOCATION`, `CPQ_HEADER_ID`, `CPQ_DETAIL_ID`, `CPQ_TIMEOUT_MS`

Operational business defaults should come from setup tables (see `CPQ_Database.md`).

---

## 12) Common Integration Pitfalls

1. Wrong base URL (ION/Mingle paths) instead of ProductConfigurator service root.
2. Including `/StartConfiguration` inside `CPQ_BASE_URL` and then appending again.
3. Wrong Configure payload shape (too many selections / wrong id/value semantics).
4. Session trimming or mutation.
5. Selected option mismatch from incorrect parser logic.
6. Duplicate feature rendering without dedupe.
