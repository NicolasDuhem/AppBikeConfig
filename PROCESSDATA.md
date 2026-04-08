# PROCESSDATA.md

## Purpose

Runtime process/data-flow reference for AppBikeConfig.

> Rule: every data behavior change must update both `DATABASE.md` and `PROCESSDATA.md`.

## 1) Authentication and authorization

- Trigger: login or protected API call.
- Auth requirement: credentials + active user.
- Entry points: `lib/auth.ts`, `lib/api-auth.ts`, `/api/auth/[...nextauth]`.
- Reads: `app_users`, `user_roles`, `roles`, `role_permissions`, `permissions`, `user_permissions`.
- Writes: none in auth path.
- Failure points: invalid credentials, inactive user, missing permission.

## 2) Feature flag read/update

- Public flag read: `/api/feature-flags/public`.
  - Reads: `feature_flags`.
  - Downstream effect: switches `/matrix` vs `/cpq-matrix` and `/bike-builder` vs `/cpq-feature`.
- Admin update: `/api/feature-flags` PATCH.
  - Writes: `feature_flags`, `feature_flag_audit`.

## 3) User/role/permission management

- Entry point: `/api/users`, `/api/roles`, `/api/permissions`, `/api/role-permissions`.
- Writes: `app_users`, `user_roles`, `user_permissions`, `role_permissions`, `role_permission_baselines_audit`, `audit_log`.
- Validation: requires `users.manage` and `permissions.manage` where applicable.

## 4) SKU definition lifecycle (canonical)

- UI/API: `/sku-definition` + `/api/sku-rules`.
- Reads: `cpq_import_rows`, `audit_log`, `app_users`, `cpq_product_attributes` (delete guard).
- Writes: `cpq_import_rows`, `audit_log`.
- Feature flags: not directly gated; functionally part of CPQ direction.
- Rollback/failure semantics: reject duplicates, block delete when references exist.

## 5) Product setup

### Primary setup path
- UI/API: `/setup` + `/api/product-setup`.
- Reads: `sku_digit_option_config`, `sku_generation_dependency_rules`, active digits from `cpq_import_rows`.
- Writes: upsert `sku_digit_option_config`; replace/upsert `sku_generation_dependency_rules`.

### Legacy setup path
- API: `/api/setup-options` (still reachable).
- Reads/Writes: `setup_options`.
- Telemetry: `deprecation.path_invoked` emitted for GET/POST/DELETE.

## 6) CPQ generation and push

### `/api/cpq/options`
- Reads active `cpq_import_rows` + setup metadata.

### `/api/cpq/generate` POST
- Reads setup metadata; in-memory generation; no writes.

### `/api/cpq/generate` GET (`run_id`)
- Reads: `cpq_import_runs`, `cpq_import_rows`.
- Writes: phase/status/error updates on `cpq_import_runs`.
- Telemetry: `cpq.import_runs.generate_get` invocation recorded.

### `/api/cpq/push`
- Writes: `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`.
- Conditional writes: may insert canonical reference rows in `cpq_import_rows`.
- Duplicate handling: local request dedupe + DB checks + rollback delete on duplicate active CPQ rule.

## 7) CPQ matrix flow

- Entry points: `/api/cpq-matrix`, `/api/cpq-matrix/save-all`, `/api/cpq-matrix/bulk-update`, `/api/cpq-matrix/check-bc-status`, `/api/cpq-matrix/picture`.
- Reads: `cpq_sku_rules`, `cpq_products_flat`, `cpq_availability`, `cpq_countries`, optional `cpq_product_assets`.
- Writes: `cpq_sku_rules`, `cpq_availability`, `cpq_product_assets`, `audit_log`, BC status updates.
- Feature flags: CPQ page routing via `import_csv_cpq`; picture path gated by `cpq_bdam_picture_picker`.

## 8) Legacy matrix flow (compatibility)

- Entry points: `/matrix`, `/api/matrix`, `/api/matrix/save-all`, `/api/matrix/bulk-update`, `/api/matrix/check-bc-status`, `/api/builder-push`, `/api/countries`.
- Reads/Writes: `products`, `countries`, `availability`, `audit_log`.
- Feature flag: used when `import_csv_cpq=false`.
- Telemetry: all major legacy matrix, countries, setup-options, and builder endpoints emit `deprecation.path_invoked`.

## 9) Additional artifacts

- Structured runtime map: `docs/process-impact-map.md`
- Deprecation sequencing and removal gates: `docs/legacy-deprecation-plan.md`
