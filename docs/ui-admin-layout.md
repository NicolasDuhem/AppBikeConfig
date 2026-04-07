# Admin UI Layout Pattern

This document defines the shared compact admin/table layout used across Sales - SKU vs Country, Product - SKU definition, Product - Create SKU from CPQ file, Admin - Users, and Admin - Feature flag.

## Desktop target and density

- Primary optimization target is **desktop ~1920x1080 with browser chrome reducing usable height** (roughly ~900-940px usable vertical space).
- Layout is table-first: page shells, toolbars, and status blocks are intentionally compact.
- Table regions should get the largest portion of both width and height.
- Avoid large hero cards and oversized helper banners above tables.
- Prefer internal table-region scrolling over whole-page scrolling.

## Shared page-shell pattern

All admin pages should follow this structure:

1. Compact page header (`AdminPageShell` title + subtitle).
2. Compact action/toolbar row for operational controls.
3. Optional collapsible filter panel/section.
4. Dominant table area (`tableWrap`) in an internal viewport container (`tableViewport`) with sticky headers.
5. Compact notes/chips for status and diagnostics.

## Global layout rules

- Use near-full width page container with reduced outer padding.
- Keep navigation visible and active tab obvious.
- Keep vertical rhythm tight (small gaps between sections).
- Prefer chips/inline summaries over large stacked cards.
- Keep admin pages in a fixed-height shell with compact Brompton header + compact navigation to maximize table rows.

## Show/Hide filters pattern

The standard table workflow now includes:

- `Show filters` / `Hide filters` control in the main toolbar.
- Filters can be collapsed to let the table consume full width.
- `Reset filters` available in toolbar and/or filter header.
- Multi-select dropdown filters are preferred for categorical fields.

## Sales - SKU vs Country filter UX pattern

- Keep free-text search only for SKU search where text match is needed.
- Use multi-select dropdown filters for business attributes, including:
  - Ruleset
  - BC Status
  - Country
  - CPQ attributes (ProductAssist, ProductFamily, ProductLine, ProductModel, ProductType, HandlebarType, Speeds, MudguardsAndRack, etc.)
- When filters are hidden, matrix table expands to the full page width.

## Product - Create SKU from CPQ file compact import/status pattern

- Keep import controls in a compact top row (file picker + import action).
- Render import diagnostics/status as compact notes/chips rather than large blocks.
- Use a compact operational toolbar for selection/push actions.
- Provide filter section and column manager as optional expandable sections.

## Column visibility controls

- Product - Create SKU from CPQ file includes a column visibility manager:
  - Show/hide per column via checkbox list.
  - Reset to default visible set.
- Reordering/resizing is not required yet; responsive width behavior is required and implemented.

## Product - SKU definition page guidance

- Keep add-rule form compact and directly above the table.
- Keep search/status controls in a compact toolbar.
- Use summary chips and concise notes; avoid oversized stacked intro content.

## Implementation note

This UI redesign intentionally does **not** alter backend/API/business logic. Changes are limited to layout, spacing, table/filter usability, and admin UX density.
