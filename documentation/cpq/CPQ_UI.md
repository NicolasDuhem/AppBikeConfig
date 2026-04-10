# CPQ UI Documentation

## Pages
- `/bike-builder`: runtime configurator UI.
- `/cpq/setup`: setup/admin UI.

## Bike Builder UI sections
1. top context selectors (account/ruleset)
2. configurator dropdown list (features/options)
3. bike preview (layered PNG)
4. summary card (IPN/price/context/session)
5. manual save card
6. sampler controls + captured results + debug panel

## UI behavior highlights
- Dropdown selection sends Configure with one changed selection.
- Returned state replaces current state.
- Debug panel shows sent sessionID, selection count, and parsing diagnostics.
- Manual save persists current captured state with `source: manual-save`.

## Setup UI tabs
- Account code management
- Ruleset management
- Picture management

Each tab supports operational CRUD patterns with compact table-focused admin layout.
