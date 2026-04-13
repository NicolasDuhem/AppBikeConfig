# ARCHITECTURE (CPQ-only retained scope)

## Retained UI routes
- `/cpq` -> CPQ Bike Builder UI (alias of `/bike-builder`)
- `/bike-builder` -> main CPQ runtime + sampler traversal/sampling UI
- `/cpq/results` -> latest sampler result tiles by IPN with picture-layer resolution
- `/cpq/setup` -> 3 setup tabs:
  1. Account code management
  2. Ruleset management
  3. Picture management

## Retained API surface
### CPQ Bike Builder runtime
- `POST /api/cpq/init`
  - Starts CPQ configuration session (or mock mode)
- `POST /api/cpq/configure`
  - Sends option changes to CPQ runtime
- `POST /api/cpq/image-layers`
  - Resolves picture layers from selected options
- `POST /api/cpq/sampler-result`
  - Persists sampler output snapshots

### CPQ Setup APIs
- `GET/POST /api/cpq/setup/account-context`
- `PUT/DELETE /api/cpq/setup/account-context/:id`
- `GET/POST /api/cpq/setup/rulesets`
- `PUT/DELETE /api/cpq/setup/rulesets/:id`
- `GET /api/cpq/setup/picture-management`
- `PUT /api/cpq/setup/picture-management/:id`
- `POST /api/cpq/setup/picture-management/sync`

## Sampler/simpering naming clarification
In source code, the process is consistently named **sampler** (`CPQ_sampler_result`, sampler traversal state, sampler sync APIs).
There is no separate `simpering` identifier in code; this document treats “simpering” as the same retained sampler process.

## Data flow
1. Builder loads active account contexts/rulesets from setup APIs.
2. Builder initializes CPQ via `/api/cpq/init`.
3. Option changes call `/api/cpq/configure` and update normalized state.
4. Sampler traversal captures configurations and persists snapshots using `/api/cpq/sampler-result`.
5. Picture layers are resolved by matching selected options to `cpq_image_management`.
6. Setup picture sync scans unprocessed sampler rows and inserts missing picture-management combinations.
7. `/cpq/results` loads latest sampler row per IPN and overlays resolved image layers.
