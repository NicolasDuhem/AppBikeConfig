# CPQ Setup Guide

## Scope
Operational/admin setup for CPQ in AppBikeConfig.

Primary UI:
- `/cpq/setup` (account context, rulesets, picture management)

Primary runtime consumer:
- `/bike-builder`

---

## 1) Prerequisites

### Environment
Set integration variables:
- `CPQ_API_KEY` (raw API key)
- `CPQ_BASE_URL` (service base)
- `CPQ_INSTANCE`
- `CPQ_PROFILE`

### Database migrations
Apply CPQ SQL scripts for:
- setup tables (`CPQ_setup_account_context`, `CPQ_setup_ruleset`)
- sampler table (`CPQ_sampler_result` + image sync flags)
- image management (`cpq_image_management` and picture slots)

---

## 2) Account Context Setup (`CPQ_setup_account_context`)

In `/cpq/setup`, open **Account code management** and create active rows.

Required fields:
- account code
- customer ID
- currency
- language
- country code (2-letter ISO, e.g. `GB`)

How it is used:
- bike-builder loads active rows,
- selected account context is passed into StartConfiguration integration parameters,
- `country_code` maps to `CustomerLocation`.

---

## 3) Ruleset Setup (`CPQ_setup_ruleset`)

In `/cpq/setup`, open **Ruleset management** and maintain records.

Required fields:
- `cpq_ruleset`
- `namespace`
- `header_id`

Recommended fields:
- description
- bike type
- sort order
- active flag

How it is used:
- bike-builder loads active rulesets,
- selected row defines ruleset/part name, namespace, header ID for StartConfiguration.

---

## 4) Picture Management Setup (`cpq_image_management`)

In `/cpq/setup`, open **Picture management**.

Identity columns (read-only conceptual key):
- `feature_label`
- `option_label`
- `option_value`

Editable columns:
- `picture_link_1`
- `picture_link_2`
- `picture_link_3`
- `picture_link_4`
- `is_active`

Use valid image URLs for transparent PNG layer assets.

---

## 5) Sync Picture Rows from Sampler Results

Use **Sync from sampler results** (POST `/api/cpq/setup/picture-management/sync`).

What sync does:
1. Reads unprocessed `CPQ_sampler_result` rows.
2. Extracts `json_result.selectedOptions[]`.
3. Builds unique rows by `(featureLabel, optionLabel, optionValue)`.
4. Inserts missing rows only.
5. Marks source sampler rows as processed.

What sync does **not** do:
- does not overwrite existing picture links,
- does not use feature_id / option_id identity.

---

## 6) Bike Builder Runtime Setup Consumption

Bike-builder startup behavior:
1. GET active account contexts.
2. GET active rulesets.
3. Auto-select first available account/ruleset.
4. StartConfiguration with selected values.

From this point:
- manual option changes use Configure,
- image layers resolve from current selected options against `cpq_image_management`.

---

## 7) Manual Save Setup Expectations

The **Save Configuration** button on bike-builder expects:
- a loaded CPQ state/session,
- account/ruleset context values populated,
- writable access to `CPQ_sampler_result`.

Saved row includes context columns + full captured JSON (`source: manual-save`).

---

## 8) Recommended Admin Sequence for New Tenant

1. Configure environment secrets/CPQ endpoint.
2. Insert account context rows.
3. Insert ruleset rows.
4. Open bike-builder and verify StartConfiguration + Configure.
5. Run sampler and/or manual save to populate `CPQ_sampler_result`.
6. Run picture sync to seed `cpq_image_management`.
7. Fill picture links in slots 1..4.
8. Re-open bike-builder and verify layered preview updates as options change.

---

## 9) Role/Permission Expectations

Setup endpoints use stricter role checks (`setup.manage` for mutations), while builder consumption endpoints use `builder.use`.

Practical impact:
- business users can run builder,
- admin users maintain setup and picture mappings.
