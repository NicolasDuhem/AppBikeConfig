# Admin UI Layout Pattern

This document defines the shared compact admin/table layout used across Sales - SKU vs Country, Product - SKU definition, Product - Create SKU, Product - Setup, Admin - Users, and Admin - Feature flag.

## Desktop target and density

- Primary optimization target is **desktop ~1920x1080 with browser chrome reducing usable height** (roughly ~900-940px usable vertical space).
- Layout is table-first: page shells, toolbars, and status blocks are intentionally compact.
- Table regions should get the largest portion of both width and height.
- Avoid large hero cards and oversized helper banners above tables.
- Prefer internal table-region scrolling over whole-page scrolling.

## Shared page-shell pattern

All admin/product pages should follow this structure:

1. Compact page header (`AdminPageShell` title + subtitle).
2. Compact action/toolbar row for operational controls.
3. Optional collapsible filter panel/section.
4. Dominant table area (`tableWrap`) in an internal viewport container (`tableViewport`) with sticky headers.
5. Compact notes/chips for status and diagnostics.

## Product - SKU definition updates

- The table area uses flex + internal overflow so vertical scroll remains inside the table viewport.
- Permanent delete action is available only to users with `sku.delete`.
- Delete uses an explicit irreversible confirmation modal and shows API feedback.

## Admin - Users updates

- Only `sys_admin` sees management controls.
- Role assignment remains baseline access.
- Per-user permission override UI supports:
  - Inherit role
  - Allow
  - Deny

## Product - Setup page pattern

- New page name: **Product - Setup**.
- Compact split-table model:
  - Digit option behavior table (`is_required`, `selection_mode`, active)
  - Dependency rules table (`source digit`, `target digit`, `rule_type`, order, active)

## Product - Create SKU filter UX pattern

- Keep generated table as primary focus.
- Provide clear reset controls:
  - Reset option selections
  - Reset generated filters
- Filter section adds searchable filter-column finder for faster scanning.
- Digit selectors should render as:
  - single select for `selection_mode = single`
  - multi select for `selection_mode = multi`
- Required/optional labels must be visible at digit group level.

## Authorization consistency rule

For all pages/actions above:
- hide controls in UI when unauthorized
- enforce same authorization in API/backend
