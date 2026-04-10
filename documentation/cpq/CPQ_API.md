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
      "headerId": "",
      "detailId": ""
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

## 6) Parsing model used by app

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

## 7) IPN extraction

IPN is extracted from response using these patterns:
- direct fields: `IPNCode`, `ipnCode`, `IPN`, `ItemNumber`
- record match where caption/name resolves to `IPN Code` and value exists
- deep scan for keys `ipncode` or `ipn`

Example expected value:
- `24R0331E6BWG0Q00H007E120BB3300`
