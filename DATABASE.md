# DATABASE (retained CPQ-only model)

## 1) `CPQ_setup_account_context`
Purpose: account/country context used by builder runtime and setup maintenance.

Fields:
- `id` (PK): surrogate key.
- `account_code` (unique): CPQ account/company code.
- `customer_id`: customer identifier sent to CPQ (optional in API payload but required in setup table).
- `currency`: default currency used in CPQ calls.
- `language`: runtime locale code.
- `country_code`: 2-letter ISO country code.
- `is_active`: whether selectable in builder.
- `created_at`, `updated_at`: audit timestamps.

Writes:
- setup APIs create/update/delete.
Reads:
- builder initial load (`activeOnly=true`).

## 2) `CPQ_setup_ruleset`
Purpose: selectable CPQ ruleset/runtime target definitions.

Fields:
- `id` (PK)
- `cpq_ruleset` (unique): retained ruleset key.
- `description`: optional setup metadata.
- `bike_type`: optional setup metadata.
- `namespace`: CPQ namespace.
- `header_id`: CPQ header id.
- `is_active`: selectable in builder.
- `sort_order`: setup ordering.
- `created_at`, `updated_at`.

Writes:
- setup APIs create/update/delete.
Reads:
- builder initial load (`activeOnly=true`).

## 3) `CPQ_sampler_result`
Purpose: persistent sampler output snapshots from builder traversal.

Fields:
- `id` (PK)
- `ipn_code`: resolved IPN key for result grouping.
- `ruleset`, `account_code`: required sampler dimensions.
- `customer_id`, `currency`, `language`, `country_code`: context dimensions.
- `namespace`, `header_id`, `detail_id`, `session_id`: CPQ session traceability.
- `json_result` (jsonb): captured sampler payload.
- `processed_for_image_sync`: marker for picture sync process.
- `processed_for_image_sync_at`: timestamp when marked processed.
- `created_at`.

Indexes:
- `(ipn_code, created_at desc, id desc)` for latest-by-IPN lookup.
- `(ruleset, account_code, country_code)` for results filters.
- partial index on unprocessed rows for picture sync.

Writes:
- `/api/cpq/sampler-result` inserts rows.
- picture sync marks rows processed.
Reads:
- `/cpq/results` filter + latest-per-IPN query.
- picture sync scanner.

## 4) `cpq_image_management`
Purpose: selected-option -> up to 4 layered image links.

Fields:
- `id` (PK)
- `feature_label`, `option_label`, `option_value`: unique matching key.
- `picture_link_1..4`: optional layer URLs.
- `is_active`: participates in runtime resolution when true.
- `created_at`, `updated_at`.

Constraints/indexes:
- unique `(feature_label, option_label, option_value)`.
- active lookup index on same triple.

Writes:
- setup picture update API.
- setup picture sync insert-on-conflict.
Reads:
- `/api/cpq/image-layers` and `/cpq/results` image resolution.
