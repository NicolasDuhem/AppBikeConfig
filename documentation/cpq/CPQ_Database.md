# CPQ Database Documentation (Neon)

## Scope
This document covers CPQ-related Neon tables used by AppBikeConfig:
- setup tables
- sampler persistence
- image management
- incremental sync metadata

Primary SQL/code references:
- `sql/cpq_setup_account_context.sql`
- `sql/cpq_setup_ruleset.sql`
- `sql/cpq_sampler_result.sql`
- `sql/cpq_image_management.sql`
- `sql/cpq_image_management_remove_ids.sql`
- `sql/cpq_image_management_add_picture_slots.sql`
- `lib/cpq/persistence.ts`
- `lib/cpq-setup.ts`

---

## 1) What belongs in ENV vs DB

### Environment (integration secrets/config)
- `CPQ_API_KEY`
- `CPQ_BASE_URL`
- `CPQ_INSTANCE`
- `CPQ_PROFILE`

### Database (business/runtime setup)
- account code
- customer id
- currency
- language
- country code
- CPQ ruleset
- namespace
- header id
- descriptions / sort order / active flags

---

## 2) `CPQ_setup_account_context`

Stores account-driven StartConfiguration context.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | identity |
| `account_code` | `text unique not null` | selected in bike-builder |
| `customer_id` | `text not null` | passed as integration parameter |
| `currency` | `text not null` | passed as integration parameter |
| `language` | `text not null` | passed as integration parameter |
| `country_code` | `text not null` | ISO2, used as `CustomerLocation` |
| `is_active` | `boolean not null default true` | controls UI active-only lists |
| `created_at`,`updated_at` | `timestamptz` | audit timestamps |

Key constraint:
- `country_code` must match `^[A-Z]{2}$`.

---

## 3) `CPQ_setup_ruleset`

Stores CPQ ruleset records presented in bike-builder and setup.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | identity |
| `cpq_ruleset` | `text unique not null` | used as ruleset/partName |
| `description` | `text` | setup display |
| `bike_type` | `text` | setup display/filtering support |
| `namespace` | `text not null default 'Default'` | StartConfiguration part namespace |
| `header_id` | `text not null default 'Simulator'` | StartConfiguration header id |
| `sort_order` | `integer not null default 0` | UI ordering |
| `is_active` | `boolean not null default true` | active-only loading |
| `created_at`,`updated_at` | `timestamptz` | audit timestamps |

---

## 4) `CPQ_sampler_result`

Stores sampled and manual-save configuration snapshots.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | identity |
| `created_at` | `timestamptz` | insert timestamp |
| `ipn_code` | `text` | extracted CPQ IPN |
| `ruleset` | `text not null` | ruleset used |
| `account_code` | `text not null` | account context |
| `customer_id`,`currency`,`language`,`country_code` | `text` | copied runtime context |
| `namespace`,`header_id`,`detail_id`,`session_id` | `text` | execution identifiers |
| `json_result` | `jsonb not null` | full captured payload |
| `processed_for_image_sync` | `boolean not null default false` | incremental picture sync flag |
| `processed_for_image_sync_at` | `timestamptz` | when row processed |

### Why full `json_result` is intentional
`json_result` is retained to preserve:
- full selected option sets,
- label/value context,
- branch traversal metadata,
- future analytics flexibility across changing CPQ schema.

### Persistence path
- API route: `POST /api/cpq/sampler-result`
- Insert logic: `persistSamplerResult()` in `lib/cpq/persistence.ts`

---

## 5) `cpq_image_management`

Stores option-to-image layer mapping used for bike preview rendering.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | identity |
| `feature_label` | `text not null` | identity part |
| `option_label` | `text not null` | identity part |
| `option_value` | `text not null` | identity part |
| `picture_link_1..4` | `text` | layered PNG slots |
| `is_active` | `boolean not null default true` | can disable mappings |
| `created_at`,`updated_at` | `timestamptz` | audit timestamps |

Unique key:
- `(feature_label, option_label, option_value)`

### Why not `feature_id` / `option_id`
Implementation deliberately avoids ID-based uniqueness because IDs can vary across runs/rulesets while business visual identity stays consistent by label/value.

---

## 6) Incremental picture sync model

Sync reads only sampler rows where:

```sql
processed_for_image_sync = false
```

For each row:
1. Parse `json_result.selectedOptions[]`
2. Build distinct `(featureLabel, optionLabel, optionValue)` combinations
3. Insert missing rows into `cpq_image_management` (do not overwrite links)
4. Mark sampler row processed and set `processed_for_image_sync_at = now()`

Benefits:
- bounded scan cost over time
- resumable behavior
- safe repeated runs

---

## 7) Setup + CRUD APIs backed by these tables

| API | Table(s) |
|---|---|
| `/api/cpq/setup/account-context` | `CPQ_setup_account_context` |
| `/api/cpq/setup/rulesets` | `CPQ_setup_ruleset` |
| `/api/cpq/setup/picture-management` | `cpq_image_management` |
| `/api/cpq/setup/picture-management/sync` | `CPQ_sampler_result` + `cpq_image_management` |
| `/api/cpq/image-layers` | `cpq_image_management` |

---

## 8) Operational queries (examples)

### Unprocessed sampler rows
```sql
select id, created_at, ruleset, ipn_code
from CPQ_sampler_result
where processed_for_image_sync = false
order by id;
```

### Picture rows still missing all links
```sql
select id, feature_label, option_label, option_value
from cpq_image_management
where (picture_link_1 is null or btrim(picture_link_1) = '')
  and (picture_link_2 is null or btrim(picture_link_2) = '')
  and (picture_link_3 is null or btrim(picture_link_3) = '')
  and (picture_link_4 is null or btrim(picture_link_4) = '')
order by feature_label, option_label, option_value;
```
