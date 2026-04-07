# AppBikeConfig Architecture (Reset)

## 1) Overview
AppBikeConfig is Brompton’s internal SKU configuration and market-allocation system. It manages SKU rule definition, SKU generation, and country-level activation using a normalized CPQ data model.

### High-level architecture
- **Source-of-truth layer**: `cpq_import_rows` (normalized option rows).
- **Control layer**: `sku_rules` (active/inactive rule lifecycle and digit/code constraints).
- **Identity layer**: `cpq_products` (one row per SKU identity).
- **Attribute mapping layer**: `cpq_product_attributes` (product-to-option references via `cpq_import_rows`).
- **Read compatibility layer**: `cpq_products_flat` (joined read model for UI and integrations).

---

## 2) Core concepts

### SKU definition
A SKU is defined by:
- static product metadata (ruleset, line, family, model, type)
- digit-based option assignments (`digit_position` + `code_value`)
- resolved option labels (`choice_value`) from normalized import rows

### CPQ model
The CPQ model is reference-based:
- options are not duplicated as raw free text in product records
- product attributes point to normalized option rows
- canonical option-name normalization ensures consistent joins and duplicate detection

### Matrix allocation
Generated SKUs are pushed into sales allocation (`SKU vs Country`) where availability is managed by country and surfaced through matrix APIs/UI.

---

## 3) Data model

### `cpq_import_rows`
Normalized CPQ option rows and diagnostics records.
- stores option-level rows (`option_name`, `choice_value`, `digit_position`, `code_value`)
- includes row status metadata (`imported`, `skipped`, `error`) and action diagnostics
- is the canonical reference table for option values

### `sku_rules`
Rule lifecycle and generation control.
- stores active/inactive rules per digit/option/code
- enforces operational structure for generation
- supports safe edits/deactivation without destructive history loss

### `cpq_products`
Product identity records.
- unique SKU identity (`sku_code`, ruleset, brake mode context)
- parent record for mapped product attributes

### `cpq_product_attributes`
Product-to-option mapping table.
- each product option references a `cpq_import_rows.id`
- enables normalized propagation of option updates

### `cpq_products_flat`
Compatibility read model.
- denormalized/select-friendly view for UI/API consumption
- preserves backward-compatible read behavior while write-path remains normalized

### `cpq_import_row_translations` (if enabled)
Localization extension table.
- stores translated labels per import row
- designed for locale-specific UI/export use without changing core references

---

## 4) Data flow

### A. Product – SKU definition
1. User manages `sku_rules` (add/edit/deactivate).
2. System validates structural consistency (digit-option constraints, active-state behavior).
3. Rules become available to generation APIs.

### B. Product – Create SKU (generation flow)
1. UI loads grouped options from `/api/cpq/options`.
2. User chooses product metadata + digit choices.
3. `/api/cpq/generate` produces combinations using canonical normalization + duplicate handling.
4. Generated rows carry option references (`__refs`) where available.

### C. Push to Sales – SKU vs Country
1. User submits selected generated rows to `/api/cpq/push`.
2. API creates `cpq_products` identity rows.
3. API resolves/links attributes into `cpq_product_attributes` via `cpq_import_rows` references.
4. API inserts activation records consumed by matrix pages/APIs.

---

## 5) Key rules

### Normalization rules
- option names are canonicalized in one module (`lib/cpq-normalization.ts`)
- aliases map to a single canonical option label
- code values are uppercase-normalized

### Duplicate handling
- duplicate digit+code entries are collapsed by latest rule where applicable
- push path skips duplicate SKU insertion
- generation path emits deterministic combinations

### Active/inactive behavior
- generation uses active rules only
- deactivated rules remain historical, not deleted

### Propagation behavior
- edits to normalized option records propagate through reference lookups
- UI read paths consume flattened/joined outputs, write paths keep references

---

## 6) API layer

### Canonical CPQ endpoints
- `GET /api/cpq/options`
  - returns grouped product fields and digit-based option choices
- `POST /api/cpq/generate`
  - generates SKU combinations from selected normalized options
- `POST /api/cpq/push`
  - persists generated SKU selections into normalized product tables and sales matrix structures

### Supporting endpoints (non-CPQ-core)
- `/api/sku-rules` for definition lifecycle
- matrix endpoints for country allocation and BC status workflows

> Legacy CSV-import route has been removed from the canonical CPQ API surface.

---

## 7) UI pages

### Sales – SKU vs Country
Country allocation management over generated/pushed SKUs.

### Product – SKU definition
Operational rule authoring and lifecycle controls.

### Product – Create SKU
Table-first generation workspace driven by normalized option references.

### Admin pages
Roles, feature flags, and system setup controls.

---

## 8) Code organization

- `lib/cpq-core.ts`
  - public CPQ core export surface
- `lib/cpq-normalization.ts`
  - canonical option normalization and mapping utilities
- `lib/cpq-generation.ts`
  - generation engine and metadata/diagnostics logic
- `lib/cpq-product-attributes.ts`
  - product attribute extraction and import-row keying

This split enforces single-responsibility and removes duplicate canonicalization logic across API handlers.

---

## 9) Performance and query guidance

- Prefer `cpq_products_flat` for read-heavy UI screens.
- Keep write-path operations normalized (`cpq_products` + `cpq_product_attributes`).
- Avoid duplicate frontend post-processing where SQL/view can return already-shaped data.
- Maintain indexes on key join columns (`cpq_import_row_id`, `sku_code`, `option_name`, `choice_value`, foreign keys).

---

## 10) Extensibility roadmap

### Translations
- expand `cpq_import_row_translations` for locale-aware labels without duplicating SKU logic

### NetSuite stock integration
- connect stock/availability feeds at matrix/read layer
- keep SKU identity stable through `cpq_products` keys

### BigCommerce integration
- retain BC status checks in matrix workflows
- extend sync metadata without coupling into core generation engine

---

## 11) Textual architecture diagram

```text
[Product - SKU definition UI]
        |
        v
    /api/sku-rules  ----->  sku_rules (control/lifecycle)

[Product - Create SKU UI]
   |            |
   |            +--> GET /api/cpq/options ---> sku_rules + cpq_import_rows
   |
   +--> POST /api/cpq/generate ---> cpq core (normalization + generation)
                                   |
                                   v
                           generated SKU rows (+ option refs)
                                   |
                                   v
                           POST /api/cpq/push
                                   |
                 +-----------------+------------------+
                 |                                    |
                 v                                    v
           cpq_products                      cpq_product_attributes
                                                    |
                                                    v
                                              cpq_import_rows

                            read compatibility
                                   |
                                   v
                             cpq_products_flat
                                   |
                                   v
                      Sales - SKU vs Country / matrix UI
```
