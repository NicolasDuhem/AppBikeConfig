# CPQ API (AppBikeConfig)

This document describes the **actual implemented CPQ API behavior** in this repository.

## 1) Base URL and endpoints

Integration code builds endpoint URLs from `CPQ_BASE_URL` and appends paths.

- Base URL (service root):
  - `https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json`
- Start endpoint:
  - `{CPQ_BASE_URL}/StartConfiguration`
- Configure endpoint:
  - `{CPQ_BASE_URL}/configure`

> Rule: `CPQ_BASE_URL` must be the service base only. Do **not** include `/StartConfiguration` in the env value.

## 2) Auth format

Requests use:

```http
Authorization: ApiKey <raw_api_key>
Content-Type: application/json
Accept: application/json
```

- `CPQ_API_KEY` must contain only the raw key.
- Do not prefix with `ApiKey` in env; code applies prefix at request time.

## 3) StartConfiguration request shape

`lib/cpq/config.ts` builds this payload:

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
      "detailId": "<guid>"
    },
    "sourceHeaderDetail": {
      "headerId": "Simulator",
      "detailId": "<base-or-parent-detail-guid>"
    },
    "integrationParameters": [
      { "name": "AccountType", "simpleValue": "Dealer", "isNull": false, "type": "string" },
      { "name": "CurrencyCode", "simpleValue": "GBP", "isNull": false, "type": "string" },
      { "name": "Company", "simpleValue": "A000286", "isNull": false, "type": "string" },
      { "name": "AccountCode", "simpleValue": "A000286", "isNull": false, "type": "string" },
      { "name": "CustomerId", "simpleValue": "<customer-id>", "isNull": false, "type": "string" },
      { "name": "LanguageCode", "simpleValue": "en-GB", "isNull": false, "type": "string" },
      { "name": "CustomerLocation", "simpleValue": "GB", "isNull": false, "type": "string" }
    ],
    "rapidOptions": null
  }
}
```

Notes:
- `CustomerId` and `LanguageCode` are included when available.
- `CustomerLocation` is derived from account setup country code.
- `part.name` equals selected ruleset/part name.
- `headerDetail.detailId` is the new working detail for this StartConfiguration.
- `sourceHeaderDetail.detailId` is optional for clone/branch behavior; when provided it points to the source detail context.

## 4) Configure request shape (minimal, working)

Configure sends one changed selection:

```json
{
  "sessionID": "BROMPTON_TRN~BROMPTON_TRN~5fad26cc-c3cb-484b-a087-5b21d6239b4a",
  "selections": [
    {
      "id": "<feature-id>",
      "value": "<selected-option-value>"
    }
  ]
}
```

Rules:
- `id` = CPQ feature ID.
- `value` = CPQ option value.
- Send only the changed selection for normal dropdown changes.
- Do not send synthetic/expanded payloads unless CPQ spec requires it.

## 5) Session handling (critical)

Session IDs are used **exactly as returned by CPQ**.

Valid example:
- `BROMPTON_TRN~BROMPTON_TRN~5fad26cc-c3cb-484b-a087-5b21d6239b4a`

Rules:
- No trimming.
- No split on `~`.
- Pass full session ID to `/configure`.
- Remember: Configure is session-driven and does not create a new detailId by itself.

## 6) Sampler branch model (implemented)

Sampler now uses StartConfiguration per sampled branch:

1. Build/load seed config once (base detail/session).
2. For each sampled variant:
   - generate `branchDetailId`
   - call StartConfiguration with `headerDetail.detailId = branchDetailId`
   - set `sourceHeaderDetail.detailId = baseDetailId` (or parent branch detail)
3. Apply branch option changes using Configure with the returned branch session.
4. Persist branch result with branch detail/session metadata.

This avoids the old configure-only chain where multiple sampled variants shared one detail/session lineage.

## 7) Parsing model used by app

Parser traverses CPQ response using:
- `Pages[]`
- `Screens[]`
- `ScreenOptions[]`
- `SelectableValues[]`

Feature mapping:
- Each `ScreenOption` becomes a feature candidate.
- Stable key priority for dedupe:
  1. `CustomProperties.FeatureID`
  2. `ScreenOption.Name`
  3. `ScreenOption.ID`

Option mapping:
- Each `SelectableValue` becomes an option.
- Local option identity is `OptionID` when present.

Selected option logic:
- Primary: `ScreenOption.Value === SelectableValue.Value`.
- Fallback: first visible+enabled option.

## 8) IPN extraction

IPN is extracted from response using these patterns:
- direct fields: `IPNCode`, `ipnCode`, `IPN`, `ItemNumber`
- record match where caption/name resolves to `IPN Code` and value exists
- deep scan for keys `ipncode` or `ipn`

Example expected value:
- `24R0331E6BWG0Q00H007E120BB3300`
