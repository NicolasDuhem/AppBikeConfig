# Admin UI Layout Pattern

This document defines the shared admin layout used by Matrix, Bike SKU Definition, Feature Flags, CPQ Feature, and Users pages.

## Layout principles

- Brompton branded header remains global in `app/layout.tsx`.
- Every admin page uses `AdminPageShell` to render:
  - page title
  - subtitle/help text
  - actions toolbar row
  - card/panel content sections
- Primary navigation is admin-focused only:
  - Matrix
  - Bike SKU Definition
  - Bike Builder **or** CPQ Feature (feature-flag controlled)
  - Users
  - Feature Flags (sys_admin only)
- No Home tab in primary navigation.
- Active tab is always visually highlighted.

## Feature-gated navigation behavior

- `import_csv_cpq = false`
  - Bike Builder shown
  - CPQ Feature hidden
  - Legacy behavior unchanged
- `import_csv_cpq = true`
  - CPQ Feature shown
  - Bike Builder hidden
  - Legacy code remains in codebase

## Access control expectations

- Feature Flags page is restricted to `sys_admin` users.
- CPQ Feature page is only reachable when `import_csv_cpq` is enabled.
- UI hides tabs as a convenience, but API/page access controls enforce permissions server-side.
