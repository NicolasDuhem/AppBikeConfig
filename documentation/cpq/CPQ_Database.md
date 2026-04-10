# CPQ Database Setup Tables

This app uses Neon tables for CPQ business/setup values, while integration-level settings remain in env.

## 1) `CPQ_setup_account_context`

Primary purpose: provide account-specific CPQ context for StartConfiguration.

### Columns

- `id` (bigserial, PK): technical key.
- `account_code` (text, unique, not null): selected account identifier used for `Company`/`AccountCode`.
- `customer_id` (text, not null): sent as `CustomerId` integration parameter.
- `currency` (text, not null): sent as `CurrencyCode`.
- `language` (text, not null): sent as `LanguageCode`.
- `country_code` (text, not null, ISO-2 check): sent as `CustomerLocation`.
- `is_active` (boolean, default true): controls active selection lists.
- `created_at`, `updated_at` (timestamptz): audit timestamps.

### Data flow into StartConfiguration

When bike-builder loads setup data:
1. `/api/cpq/setup/account-context?activeOnly=true` returns active rows.
2. Selected row populates UI context (`accountCode`, `customerId`, `currency`, `language`, `countryCode`).
3. `/api/cpq/init` forwards this as `context`.
4. `buildStartConfigurationPayload()` maps this context into `integrationParameters`.

## 2) `CPQ_setup_ruleset`

Primary purpose: provide ruleset + CPQ part metadata for StartConfiguration.

### Columns

- `id` (bigserial, PK): technical key.
- `cpq_ruleset` (text, unique, not null): selected CPQ part/ruleset name.
- `description` (text, nullable): setup/admin description.
- `bike_type` (text, nullable): setup/admin categorization.
- `namespace` (text, not null, default `Default`): sent as `part.namespace`.
- `header_id` (text, not null, default `Simulator`): sent as `headerDetail.headerId`.
- `is_active` (boolean, default true): controls active selection lists.
- `sort_order` (integer, default 0): ordering in setup/UIs.
- `created_at`, `updated_at` (timestamptz): audit timestamps.

### Data flow into StartConfiguration

1. `/api/cpq/setup/rulesets?activeOnly=true` returns active rulesets.
2. Selected row sets bike-builder target (`ruleset`, `partName`, `namespace`, `headerId`).
3. `/api/cpq/init` uses these values.
4. StartConfiguration payload sends:
   - `part.name = cpq_ruleset`
   - `part.namespace = namespace`
   - `headerDetail.headerId = header_id`

## 3) Env vars vs DB-driven values

### Integration env (still env-driven)

- `CPQ_API_KEY`
- `CPQ_BASE_URL`
- `CPQ_INSTANCE`
- `CPQ_PROFILE`
- `CPQ_TIMEOUT_MS`
- fallback defaults like `CPQ_NAMESPACE`, `CPQ_PART_NAME`, `CPQ_HEADER_ID`

These are infrastructure/integration concerns.

### Business/setup values (DB-driven direction)

- account code
- customer id
- currency
- language
- country code
- ruleset
- namespace
- header id
- bike type
- description
- sort order
- active flags

These are maintained in setup tables and setup UI.

## 4) `CPQ_sampler_result` branch persistence expectation

Sampler persistence must reflect per-branch StartConfiguration behavior:

- `detail_id` = branch detailId generated for that sampled variant.
- `session_id` = sessionId returned for that branch.
- `json_result` should include:
  - `baseDetailId`
  - `sourceDetailId`
  - `branchDetailId`

If two sampled variants start separate branches, their `detail_id` values should differ.
