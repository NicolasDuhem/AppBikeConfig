# CPQ BDAM Picture Picker (Feature-flagged, iframe/manual v1)

## Overview

This release adds a **feature-flagged** BDAM picture picker workflow to CPQ Matrix.

- Feature flag key: `cpq_bdam_picture_picker`
- Flag name: `CPQ BDAM Picture Picker`
- Purpose: enable an iframe/manual asset-link workflow on CPQ Matrix rows, without any server-side BDAM API integration.

When the flag is **OFF**, CPQ Matrix behavior remains unchanged.

When the flag is **ON**, each CPQ Matrix row gets a `Pick picture` action that opens a shared modal.

## Feature flag behavior and safety

- `cpq_bdam_picture_picker = false`
  - no `Pick picture` row action
  - no picker modal entry point
  - no CPQ Matrix behavior changes
- `cpq_bdam_picture_picker = true`
  - `Pick picture` row action available
  - user can open modal, browse BDAM in iframe, and manually capture asset details

Only `sys_admin` can manage the flag from Feature Flags page/API, using existing feature-flag audit behavior (`feature_flag_audit`).

## CPQ Matrix UX

When enabled:

- New row action button: `Pick picture`
- New `Picture` column indicator:
  - `Picture linked` badge when an asset URL exists
  - `View asset` link opens stored asset URL in a new tab
  - action can be reused to replace/edit saved values

## Modal flow (v1 manual capture)

Modal copy:

- Title: `Pick picture`
- Helper text:
  - `Browse BDAM in the embedded view. If needed, open BDAM in a new tab and paste the selected asset link below.`

Embedded iframe URL:

- `https://dam.brompton.com/pages/home.php`

Manual fields:

- `Asset URL` (required)
- `PNG URL` (optional)
- `Asset ID` (optional)
- `Notes` (optional)

Preview behavior:

- A lightweight preview appears when `Asset URL` or `PNG URL` looks like a valid `http(s)` URL.

## Iframe fallback behavior

Because BDAM/browser policy may block iframe embedding (`X-Frame-Options` / CSP):

- Modal always shows fallback guidance
- Includes `Open BDAM in new tab` button
- User can still complete the workflow by pasting selected links manually
- App does not depend on iframe interaction events for save

## Data storage

v1 stores picker data in linked table:

- Table: `cpq_product_assets`
- Relationship: one asset record per CPQ rule (`cpq_sku_rule_id` unique)

Persisted fields:

- `cpq_sku_rule_id`
- `asset_url`
- `png_url` (nullable)
- `asset_id` (nullable)
- `notes` (nullable)
- `selected_by`
- `selected_at`
- `updated_by`
- `updated_at`

Audit:

- Save/replace writes an audit log entry (`entity_type = cpq_product_asset`) via existing audit utility.

## Future API-based DAM integration (not in scope)

This v1 intentionally does **not** include server-side BDAM API integration.

Future iterations may add:

- validated asset search/select APIs
- metadata syncing from DAM
- stronger URL/asset-id validation and de-duplication
- webhook/event-based refresh flows
