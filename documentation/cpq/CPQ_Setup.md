# CPQ Setup Guide

## 1) Setup surfaces

- Admin/setup page: `/cpq/setup`
- Bike-builder page: `/bike-builder`

`/cpq/setup` manages Neon tables used by CPQ runtime selection.

## 2) Account context setup

Table: `CPQ_setup_account_context`

Required fields when creating/updating:
- `account_code`
- `customer_id`
- `currency`
- `language`
- `country_code` (must be 2-letter ISO code, e.g. `GB`, `FR`, `DE`)

How it affects CPQ StartConfiguration:
- `account_code` -> `Company` and `AccountCode`
- `customer_id` -> `CustomerId`
- `currency` -> `CurrencyCode`
- `language` -> `LanguageCode`
- `country_code` -> `CustomerLocation`

## 3) Ruleset setup

Table: `CPQ_setup_ruleset`

Core fields:
- `cpq_ruleset`
- `namespace`
- `header_id`

Optional metadata:
- `description`
- `bike_type`
- `sort_order`
- `is_active`

How it affects CPQ StartConfiguration:
- `cpq_ruleset` -> `part.name`
- `namespace` -> `part.namespace`
- `header_id` -> `headerDetail.headerId`

## 4) Setup UI behavior

### Account management section
- Create / edit / delete account context rows.
- Toggle active flag.
- Country code input is uppercased and validated to ISO-2 format.

### Ruleset management section
- Create / edit / delete ruleset rows.
- Define namespace/header for each ruleset.
- Control display/order with active + sort order.

## 5) Runtime selection behavior in bike-builder

1. Bike-builder loads active account contexts and rulesets.
2. First active rows prefill current selections.
3. Account selection changes CPQ context values.
4. Ruleset selection triggers fresh StartConfiguration.
5. Configure calls continue within returned session for manual/UI edits.

## 6) Sampler/traversal detail-session behavior

- Sampler keeps a base seed record (ruleset, namespace, header, account context, base detail/session).
- For each sampled variant, sampler starts a fresh branch by calling StartConfiguration again.
- Branch StartConfiguration uses:
  - new `headerDetail.detailId` (new branch detailId)
  - `sourceHeaderDetail.detailId` = base detailId (or parent detail when chaining).
- Configure is used only after branch StartConfiguration to apply option changes.
- Saved `CPQ_sampler_result` rows should contain branch detail/session values (not seed detail/session).

## 7) Integration settings still required in environment

Set these env variables in runtime (local/Vercel):
- `CPQ_API_KEY`
- `CPQ_BASE_URL`
- `CPQ_INSTANCE`
- `CPQ_PROFILE`

Keep `CPQ_BASE_URL` as service root (`.../json`), not endpoint-specific path.
