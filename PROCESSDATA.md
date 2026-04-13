# PROCESSDATA (retained processes)

## 1) CPQ bike builder initial load
- Trigger: open `/cpq` or `/bike-builder`.
- Inputs: none (client page mount).
- Tables read:
  - `CPQ_setup_account_context` (active rows)
  - `CPQ_setup_ruleset` (active rows)
- Tables written: none.
- Validations: client validates account/ruleset selection before runtime calls.
- Output: first account/ruleset pre-selected in UI.

## 2) CPQ bike builder reconfigure/change cycle
- Trigger: option change in builder feature list.
- API chain:
  - `POST /api/cpq/init` for session bootstrap
  - `POST /api/cpq/configure` for subsequent changes
- Inputs: ruleset, namespace, header/detail/session IDs, selected feature+option.
- Tables read/written: none directly.
- Validations:
  - API validates required request keys (`sessionId`, `featureId`, `optionValue` for configure).
- Output:
  - normalized CPQ state (features/options/session/IPN metadata)
  - refreshed selectable options for next cycle.

## 3) Sampler/simpering process (implemented as sampler)
- Trigger: user starts traversal/sampler run in builder UI.
- Source inputs:
  - current builder state
  - active account/ruleset context
  - traversal controls (mode, depth, max results/calls/runtime)
- Tables read:
  - `cpq_image_management` (optional image preview resolution)
- Tables written:
  - `CPQ_sampler_result` via `POST /api/cpq/sampler-result`
- Validations:
  - `ruleset` and `account_code` required at persistence boundary.
- Output:
  - persisted sampler snapshots with selected options and metadata.

## 4) Account code setup flow
- Trigger: `/cpq/setup` -> Accounts tab (create/update/delete).
- APIs:
  - `GET/POST /api/cpq/setup/account-context`
  - `PUT/DELETE /api/cpq/setup/account-context/:id`
- Tables read/write: `CPQ_setup_account_context`.
- Validations:
  - required fields + 2-letter ISO country code.
- Output:
  - updated account context list for builder/setup.

## 5) Ruleset setup flow
- Trigger: `/cpq/setup` -> Rulesets tab.
- APIs:
  - `GET/POST /api/cpq/setup/rulesets`
  - `PUT/DELETE /api/cpq/setup/rulesets/:id`
- Tables read/write: `CPQ_setup_ruleset`.
- Validations:
  - `cpq_ruleset` required; defaults for namespace/header/sort.
- Output:
  - updated ruleset list used by builder.

## 6) Picture management flow
- Trigger: `/cpq/setup` -> Pictures tab.
- APIs:
  - `GET /api/cpq/setup/picture-management`
  - `PUT /api/cpq/setup/picture-management/:id`
  - `POST /api/cpq/setup/picture-management/sync`
- Tables read:
  - `cpq_image_management`
  - `CPQ_sampler_result` (sync only)
- Tables written:
  - `cpq_image_management` (manual update + sync insertion)
  - `CPQ_sampler_result` processed flags (sync)
- Validations:
  - only non-empty feature/option/values produce sync inserts.
- Output:
  - maintained image lookup mappings used by builder/results rendering.
