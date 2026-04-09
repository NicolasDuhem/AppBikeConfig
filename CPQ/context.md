# tp2-bike-builder-poc — Context

This document captures the purpose, architecture, decisions, and current state of this proof-of-concept. It is intended as a handover reference for any developer picking up the work.

---

## Purpose

A standalone POC demonstrating how Brompton's Trade Platform 2 (TP2) could integrate with **Infor CPQ v4** for bike configuration and catalogue browsing. The goal is to validate:

1. Starting a CPQ configuration session and normalising the response
2. Driving a configure-as-you-go UI where option changes call CPQ in real time
3. Building a product catalogue from live CPQ data (no hardcoded product lists)
4. Finalising a configuration to hand off to a downstream order service

This replaces the legacy approach in `Brompton.Ordering.Data` / `Brompton.API`, which used a different CPQ integration layer and a database-driven list of **bike types** (each row points at a CPQ ruleset — see terminology below).

---

## Terminology — bike types vs configuration variants

Language in Jira, BigCommerce, and CPQ overlaps on “variant”. In this document and for B2B bike catalogue discussions, use:

| Term | Meaning |
|------|--------|
| **Bike type** (product type) | A sellable **model family** such as C line, P line, T line — the level that the legacy DB table (`frt.CpqBikeType`) represents. **One bike type ↔ one CPQ ruleset** (`part.name` / ruleset name in Infor). |
| **Configuration variant** | A **distinct finished configuration** within a single ruleset: a **permutation of personalisation choices** (handlebar, colour, rack, gears, etc.) that CPQ accepts as valid. This is what the business wants **listed on the PLP** after the dealer picks a bike type (e.g. “C line”): **many rows per bike type**, not one row per type. |
| **BigCommerce variant** | The **e-commerce** entity: a variant row under a parent product in BigCommerce (may carry SKU, EAN, MPN, etc.). It may mirror a **configuration variant** if the catalogue method pre-materialises CPQs, but the words are not interchangeable. |

**Target UX (product intent):** Category / bike type navigation → for the selected **bike type**, the PLP shows **configuration variants** derived from that type’s **ruleset** and its allowed personalisation options — ideally **sourced from CPQ** (or a faithful projection) so the grid cannot drift from what can actually be ordered.

**This POC today:** The catalogue API still returns **one card per bike type** (one `StartConfiguration` per ruleset at a default state). It does **not** yet enumerate **configuration variants** per ruleset.

**Near-term product priority:** **PLP listing configuration variants** (with **lazy loading**) is prioritized over a **full dedicated configurator** page; see **Business alignment — Decisions & preferences**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Client | React 19, Vite 6, React Router 7, TanStack Query 5, Zustand 5, Tailwind 4 |
| Server (BFF) | Express 4, TypeScript, tsx (dev), dotenv |
| CPQ | Infor CPQ v4 REST API (`ProductConfiguratorUI.svc/json/*`) |
| Build | `tsc` + Vite; single `npm run dev` starts both via `concurrently` |

---

## Project Structure

```
tp2-bike-builder-poc/
├── server/src/
│   ├── index.ts                   — Express app entry, dotenv bootstrap
│   ├── routes/
│   │   └── cpq.ts                 — All BFF endpoints (/api/cpq/*)
│   └── lib/cpq/
│       ├── client.ts              — HTTP wrappers for Infor CPQ endpoints + debug logging
│       ├── contracts.ts           — Zod schemas for request validation
│       ├── mappers.ts             — CPQ JSON → NormalizedState; mock state generator
│       ├── catalogue.ts           — Catalogue card builder; model-defining feature detection
│       └── session-store.ts       — In-memory browser-token → CPQ sessionID map (4h TTL)
│
├── client/src/
│   ├── App.tsx                    — React Router route tree
│   ├── routes/
│   │   ├── HomePage.tsx           — Landing / entry point
│   │   ├── CategoryNavigationPage.tsx — Grid of category tiles
│   │   ├── CataloguePage.tsx      — Per-category product card listing
│   │   └── BikeBuilderPage.tsx    — Full CPQ configure page
│   ├── components/bike-builder/
│   │   ├── OptionGrid.tsx         — Renders CPQ features as radio/select groups
│   │   ├── OptionField.tsx        — Single feature row
│   │   ├── ReviewPanel.tsx        — Price, IPN code, weight summary
│   │   └── OrderActions.tsx       — Finalise / add to order buttons
│   ├── lib/bike-builder/
│   │   ├── useBikeBuilder.ts      — Core hook: start/configure/finalize orchestration
│   │   ├── store.ts               — Zustand store (NormalizedState + pending selections)
│   │   ├── reducer.ts             — applyServerSnapshot (replaces local state with CPQ snapshot)
│   │   └── diff.ts                — selectionsFingerprint (shallow change detection)
│   ├── lib/api/
│   │   └── client.ts              — Axios instance pointing to BFF /api
│   └── types/
│       └── bike-builder.ts        — Shared client-side types (mirrors server mappers.ts types)
│
├── .env                           — Local env (not committed)
├── .env.example                   — Documented env template
├── vite.config.ts                 — Vite + proxy /api → BFF port
├── package.json                   — Single package for both client and server
├── tsconfig.json                  — Client TypeScript config
└── tsconfig.server.json           — Server TypeScript config
```

---

## Environment Variables

All env vars are documented in `.env.example`. Required vars for live CPQ:

| Variable | Purpose |
|---|---|
| `CPQ_API_KEY` | Infor API key (omit or set `CPQ_MOCK=1` for mock mode) |
| `CPQ_INSTANCE_NAME` | Infor tenant instance (e.g. `BROMPTON_TRN`) |
| `CPQ_APPLICATION_NAME` | Infor application name (e.g. `BROMPTON_TRN`) |
| `CPQ_RULESET` | Single CPQ ruleset name used when `CPQ_RULESETS_JSON` is not set |
| `CPQ_NAMESPACE` | CPQ namespace for the ruleset |
| `CPQ_HEADER_ID` | Header ID passed in `StartConfiguration` |
| `CPQ_RULESETS_JSON` | JSON array of **bike types** (rulesets) to show in the catalogue — not configuration variants (see **Terminology**) |
| `CPQ_INTEGRATION_PARAMETERS_JSON` | JSON array merged into `integrationParameters` (AccountType, CurrencyCode, Company, CustomerLocation) |
| `CPQ_DEBUG_HTTP` | Set to `1` to log all BFF→Infor requests/responses (Authorization redacted) |

No Brompton-specific defaults are baked into the code. If required vars are missing, the BFF returns a clear error.

---

## API Endpoints (BFF)

All endpoints are under `/api/cpq/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cpq/catalogue?category=<cat>` | Returns `BikeSkuCard[]` for the given category |
| `POST` | `/api/cpq/start` | Starts a CPQ session; returns `NormalizedState` + `FeatureVariants[]` |
| `POST` | `/api/cpq/configure` | Applies one or more option selections; returns updated state |
| `POST` | `/api/cpq/finalize` | Finalises the CPQ session |
| `POST` | `/api/cpq/reset` | Clears the browser session |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/cpq/configuration-variants?bikeTypeId=&cursor=&limit=` | Paginated configuration variants (one `StartConfiguration` per variant key slice); optional dev header `X-BB-Customer-Location` overrides `CustomerLocation` — see [docs/cpq-variant-enumeration-notes.md](docs/cpq-variant-enumeration-notes.md) |

Session identity is tracked via an `HttpOnly` cookie (`bb_poc_session`) set by the BFF. The cookie maps a random browser token to the CPQ `sessionID` server-side. Sessions expire after 4 hours.

### Production requirement — dealer market context

- **`CustomerLocation`** (and **`CurrencyCode`** / **`Company`** when CPQ rules require them) must be resolved **server-side** from the **authenticated dealer company’s country** (or equivalent TP2 account profile), not from unchecked client-supplied body fields.
- Every **`StartConfiguration`** used for **catalogue** or **configuration-variant PLP** must use that context so dealers only see variants valid for their market (aligns with BS-2537 and product preference).
- **POC / dev:** an optional request header (e.g. `X-BB-Customer-Location`) or env-only defaults may override **`CustomerLocation`** for local testing. This must **not** be the production source of truth.

---

## CPQ Data Model — Key Concepts

### StartConfiguration

Called with:
- `instance` + `application` — Infor tenant identifiers
- `part.namespace` + `part.name` — the ruleset (e.g. `BBLV6_C-LineElecMY26_Brixton`)
- `headerDetail.headerId` + `headerDetail.detailId` — the order context; `detailId` is a fresh UUID per session
- `integrationParameters` — account context (AccountType, CurrencyCode, Company, CustomerLocation); without these, CPQ rules may fail with `FetchFirstValueFromOptionList`
- `variantKey` — optional; pre-selects all options for a named variant in CPQ Design Studio

Returns a `Pages → Screens → ScreenOptions` tree. Each `ScreenOption` is one configurable feature. `SelectableValues` on each option are the available choices.

### Configure

Called with `sessionID` + a single `option` `{ id, value }` to update one feature selection. CPQ re-runs rules and returns the updated full state.

### NormalizedState

The BFF normalises the raw CPQ JSON into a flat `NormalizedState` (see `mappers.ts`):

```typescript
type NormalizedState = {
  sessionId: string;
  isExecutionComplete: boolean;
  configuredPrice: number;       // CPQ calculated trade price
  currencyCode?: string;
  productDescription: string;    // from CPQ Details rows
  productCode: string;           // IPN code from CPQ Details rows
  weightKg: number | null;       // aggregated from per-option UnitWeight
  msrp: number | null;           // aggregated from per-option MSRP
  tradePrice: number | null;     // configuredPrice when isExecutionComplete
  features: FeatureField[];      // all CPQ screen options, normalised
};
```

Each `FeatureField.options` entry (`SelectableOption`) now carries two CPQ custom property signals:

- `ipnCode` — the IPN position code for that option (from CPQ `IPNCode` custom property)
- `forecastAs` — demand forecast classification code (from CPQ `ForecastAs` custom property)

---

## Catalogue Architecture

### Core concept: one ruleset = one bike type (not one PLP row for production)

In the legacy Brompton Trade system, **`frt.CpqBikeType`** holds **bike types** (C line, P line, etc.), not every personalisation permutation. Each row has a **CPQ ruleset name** — e.g. “New C line Electric”, “New T line” — pointing at a distinct Infor ruleset.

**In this POC**, each entry in `CPQ_RULESETS_JSON` is therefore **one bike type** (one ruleset). The BFF calls `StartConfiguration` once per matching ruleset and builds **one `BikeSkuCard`** — effectively a **single representative snapshot** (default / initial CPQ state), not the full set of **configuration variants** for that type.

**Personalisation choices** (handlebar, colour, rack, saddle height, etc.) live inside the ruleset. For **production B2B**, those choices define **configuration variants** that should appear as **separate PLP rows** under that bike type; the POC does not yet generate those rows. An earlier POC observation (some handlebar/rack combinations sharing the same trade price in one session) spoke to **pricing/SKU structure**, not to whether each permutation should be **merchandised** as its own catalogue line — product has clarified that **permutation-level listing** is the goal for the PLP.

### CPQ_RULESETS_JSON format

```json
[
  {
    "id": "c-elec-26",
    "ruleset": "BBLV6_C-LineElecMY26_Brixton",
    "namespace": "Default",
    "headerId": "Simulator",
    "line": "c",
    "isElectric": true,
    "displayTitle": "New C line Electric"
  },
  {
    "id": "c-line-26",
    "ruleset": "BBLV6_C-Line_MK6_MY26",
    "namespace": "Default",
    "headerId": "Simulator",
    "line": "c",
    "isElectric": false,
    "displayTitle": "New C line"
  }
]
```

`line` values: `"c"` | `"p"` | `"g"` | `"t"` | `"special"`

If `CPQ_RULESETS_JSON` is not set, the single `CPQ_RULESET` / `CPQ_NAMESPACE` / `CPQ_HEADER_ID` is used and the line/electric category is inferred from the CPQ response itself (via the `Line` and `ProductAssist` features).

### Catalogue request flow

```
GET /api/cpq/catalogue?category=electric-c-line
        │
        ▼
  CPQ_RULESETS_JSON set?
  ┌─────────────┴────────────────┐
  NO                            YES
  │                              │
  ▼                              ▼
  Use single ruleset        Filter entries where
  (CPQ_RULESET etc.)        line=c, isElectric=true
        │                        │
        ▼                        ▼
  StartConfiguration        For each matching entry:
  → normalise               StartConfiguration → normalise
  → detect line/electric    → use entry metadata
  from CPQ features
        │                        │
        └──────────┬─────────────┘
                   ▼
           One BikeSkuCard per bike type (ruleset)
           — POC only; production target is many
           configuration variants per bike type
           (title, live trade price, live MSRP,
            highlights from CPQ features,
            configureQuery: { ruleset, namespace, headerId })
```

---

## Model-Defining Feature Detection (CPQ-driven)

The `isModelDefiningFeature(f: FeatureField): boolean` function in `catalogue.ts` estimates whether a CPQ feature is **commercially / IPN-distinct** (model-defining) vs a **personalisation** dimension. That may later help decide **which option axes generate separate configuration variants** on the PLP versus which stay in the configurator only — **not yet decided** (see **Unresolved questions** in Business alignment).

It uses only CPQ data — no hardcoded feature name list.

**Signal 1 — `forecastAs`**: If any option in a feature has a non-empty `ForecastAs` custom property, that option is commercially tracked as a distinct product. The feature is model-defining.

**Signal 2 — `ipnCode` distinctness**: If options within a feature have two or more different non-empty `IPNCode` values, they contribute different codes to the product IPN. The feature is model-defining.

This function is exported and can be used by the bike builder page to visually distinguish key model choices from personalisation options in the configure UI.

> **Note:** In Brompton's current CPQ ruleset the `ForecastAs` field is empty for all observed options. The `ipnCode` signal has not yet been verified for Handlebar Type / Add Rack because the CPQ response body is large and the features appear beyond the debug log truncation point (12KB). Verification requires either increasing `CPQ_DEBUG_HTTP` log limit or a dedicated debug endpoint. Until verified, the function will return `false` for all features in the current ruleset, and the configure UI treats all visible features equally.

---

## Bike Builder (Configure) Flow

```
User navigates to /configure?ruleset=<rs>&namespace=<ns>&headerId=<hi>
        │
        ▼
useBikeBuilder hook mounts
        │
        ▼
POST /api/cpq/start  { partName, partNamespace, headerId }
        │
        ▼  (BFF)
buildStartPayload → cpqStartConfiguration (Infor)
        │
        ▼
normalizeConfiguratorResponse → NormalizedState
        │
        ▼
setCpqSession(browserToken, sessionId)   ← HttpOnly cookie
        │
        ▼
Return { ok, state: NormalizedState, variants: FeatureVariants[] }
        │
        ▼
Client: store.setStateFromServer(state)
OptionGrid renders features as radio/select groups
        │
User picks an option
        │
        ▼
applyOptimisticSelection(cpqOptionId, value)  ← instant UI update
queueSelection(cpqOptionId, value)
scheduleFlush()  ← debounce 280ms
        │
        ▼  (after debounce)
POST /api/cpq/configure  { selections: [{ id, value }] }
        │
        ▼  (BFF)
cpqConfigure(Infor) → normalizeConfiguratorResponse
        │
        ▼
Return updated NormalizedState
        │
        ▼
store.setStateFromServer → ReviewPanel updates
        │
User clicks "Add to new order" / "Add to existing order"
        │
        ▼
POST /api/cpq/finalize → cpqFinalize(Infor)
[hook into downstream order service here]
```

---

## Mock Mode

When `CPQ_API_KEY` is not set (or `CPQ_MOCK=1`), the BFF operates in mock mode:

- `/api/cpq/start` and `/api/cpq/configure` return a synthetic `NormalizedState` from `mockNormalizedState()` in `mappers.ts`, without making any HTTP calls to Infor
- `/api/cpq/catalogue` returns a single generic mock card labelled "(mock)"
- The client UI shows a warning banner

Mock mode exists so frontend development can proceed without CPQ credentials.

---

## Business alignment — PLP, configuration variants, CPQ, and BigCommerce

This section records **understood** product intent from Jira (**Story Description**, Technical Analysis, Acceptance Criteria, and key comments) as of March 2026. It uses **Terminology** above: **bike type** vs **configuration variant** vs **BigCommerce variant**.

**References:** [BS-2501](https://brompton.atlassian.net/browse/BS-2501) · [BS-2154](https://brompton.atlassian.net/browse/BS-2154) · [BS-2241](https://brompton.atlassian.net/browse/BS-2241) · [BS-2537](https://brompton.atlassian.net/browse/BS-2537)

### Jira — Story Descriptions (source text)

These are the **Story Description** fields (primary user-facing intent per ticket).

**BS-2501 — Variant PLP for B2B Platform**

> As a dealer when using the B2B platform, I want to see all the products available in the Brompton product catalogue and be able to filter based on product categories, product attributes and sort based on price and recommended items. In addition I want to be able to search by EAN code and filter by the bike type and variant  
> Requirements: TPV2_REQ_0017, TPV2_REQ_0019, TPV2_REQ_0118

**BS-2154 — Bike Builder CPQ Integration for BigC B2B**

> As a dealer, I want to be able to order a specific configuration of a bike and for that configuration to show me accurate pricing and generate an accurate configuration code, so that I can place and receive an order for that bike configuration  
> Requirement: TPV2_REQ_0103

**BS-2241 — Insert CPQ Bike Builder into B2B platform**

> As a dealer, I want to be able to order a specific configuration of a bike and add that bike configuration into my order  
> Requirements: TPV2_REQ_0030, TPV2_REQ_0031

**BS-2537 — Test Detail ID integration for CPQ for different countries**

> Need to verify if using the same detail id for different countries, sets the correct country specific job order / BOM for the country specific build in CPQ for the sales order process.  
> To test for: US, FR, UK

### Synthesised requirements (by theme)

**Product listing (BS-2501) — read alongside “bike type” / “variant”**

- Dealers need the **full Brompton B2B catalogue** with **filters** (categories, attributes), **sort** (price, recommended), **EAN search**, and filters for **bike type** and **variant**.
- **CPQ configuration variants** are what dealers need on the bike PLP under each **bike type** (ruleset). Jira / BC docs sometimes phrase this as “variant products” on the PLP — that can mean **BC variant rows** as a *presentation* layer, not necessarily that BC is the **source of truth** for what exists or what it costs (see **Target architecture** below).

**Bike builder & CPQ integration (BS-2154, BS-2241)**

- **BS-2241:** Legacy-style **bike builder** in B2B: choose options, review, add to new/existing order, **load by CR**, **load by EAN**, reset. CPQ work sits under **BS-2154**.
- **BS-2154 — two approaches:**
  1. **Dedicated configurator** — live CPQ for options, price, description, product code, configuration reference, weight, trade price / MSRP.
  2. **Pre-built catalogue** — **ruleset** on **parent** BC SKU; **CPQ `detailId`** on **variant** MPN (or similar); supports **EAN** on PLP without opening the configurator first. Marked **“(currently the preferred method)”** in the story at time of writing — this is the **BC cache / mirror** path POs are exploring; it **tensions** with the **CPQ-SoT** preference in **PO exploration vs preferred target architecture** until PO/engineering align.
- **BS-2154** (active AC): Order lines with **parent SKU = ruleset** and **variant MPN = CPQ detail id** must resolve in CPQ to the configuration that **matches** that catalogue line.
- **BS-2241 comments:** Whether configuration flows should **create BC products**; legacy TP can resolve CPQ via **EAN**.

**Cross-country `detailId` (BS-2537)**

- **Hypothesis tested:** Same **detail id** across **US / FR / UK** with correct country-specific BOM/job order.
- **Result (comment, Mar 2026):** **Failed** — reusing an **FR** configuration id for **GB** kept **FR-specific** BOM/items and incorrect brake-related SKU behaviour.
- **Implication:** **Detail id** is **not** a portable long-lived key across markets without **re-running** CPQ or **per-market** identifiers — impacts any design that stores one `detailId` per **BigCommerce variant** globally.

### Tension with this POC (today)

| Topic | Current POC | Target / Jira |
|--------|-------------|----------------|
| PLP row granularity | **One card per bike type** (one `StartConfiguration` per ruleset, default state). | **Many PLP rows per bike type** — **configuration variants** from that ruleset’s personalisation space (and/or BC variants that mirror them). |
| Meaning of “variant” in docs | Previously easy to conflate with “bike type”. | **Bike type** = ruleset; **configuration variant** = CPQ permutation; **BC variant** = commerce row — keep separate. |
| BS-2501 implementation path | N/A in POC. | Technical analysis is **BC-first** PLP; product preference is **CPQ-accurate** configuration variants — may require **projection**, **sync**, or **BFF enumeration** from CPQ. |
| Stored `detailId` on BC | Not implemented. | **BS-2154** catalogue method + **BS-2537** imply **stale or wrong** data if `detailId` is reused across countries or never refreshed. |

### PO exploration vs preferred target architecture (recorded Mar 2026)

**What POs are trying**

- Materialise **configuration variants** as **BigCommerce variants** (one BC row per sellable configuration), store **CPQ `detailId`** against each BC variant — effectively a **cached mirror** of CPQ for PLP, search, and order payloads.

**Engineering concern**

- That pattern risks **data inconsistency** (rules, prices, validity, **BS-2537** market context) if BC is treated as authoritative. It can **undercut the reason for a dedicated CPQ engine** if commerce data drifts from live rules.

**Preferred direction (CPQ as source of truth)**

- **CPQ** is the **source of truth** for **which configuration variants exist**, **prices**, and **validity** for a dealer context.
- **BigCommerce** holds **base bike types** (parent products / ruleset alignment) so the **commerce order** still runs in BC, but the **selected configuration** is identified with the **correct CPQ detail id** (and related CPQ-derived data) at order time — obtained via **CPQ-backed flows** (e.g. BFF calling CPQ), not by trusting a **stale** BC copy as SoT.
- PLP can still *display* variant rows from data **served by a layer that reads CPQ** (or short-lived cache with explicit invalidation), without making “whatever is in BC” the definition of truth.

*This preference is not necessarily signed off by POs; document conflicts with **BS-2154** wording that treats BC+MPN as the catalogue method.*

### Decisions & preferences (recorded answers)

| Topic | Position |
|--------|----------|
| **Cardinality of PLP rows vs ruleset** | **Ruleset-dependent.** The count is **less than or equal to** all **legally valid** CPQ combinations for that ruleset (rules may exclude some permutations). |
| **Large PLPs** | **Lazy loading** (e.g. paginated / infinite scroll or progressive fetch) is acceptable. |
| **EAN** | Likely **variant-level** in the target model; **confirm** by inspecting **live CPQ** responses and current CPQ configuration (not guess from docs alone). |
| **Authority / sync** | Same as **preferred direction** above: **CPQ SoT** for variants and pricing; avoid BC mirror as the long-term truth unless paired with a strict sync story. |
| **Country visibility** | A dealer sees only **configuration variants available in the country of their company** (filter by market / integration context — aligns with needing correct CPQ parameters per territory and **BS-2537** lessons). |
| **Configurator vs PLP priority** | **PLP showing variants** is **high priority**. A **dedicated full configurator** page (**BS-2241**) is **not finalized**; timeline pressure has pushed POs toward **PLP-first**. **PLP > full configurator** for near-term delivery order. |

### Remaining open items (for design / PO sign-off)

1. **Exact CPQ mechanics** — Which Infor APIs or artefacts enumerate or resolve variants (`variantKey`, session search, exports, etc.)? Spike with real API calls.
2. **PO alignment** — Confirm whether the **preferred CPQ-SoT** shape is acceptable versus the **BC variant + detail id cache** path; may affect **BS-2154** acceptance approach.
3. **Order payload** — Concrete pattern for “BC line item ↔ CPQ detail id” when detail ids are **not** stored as static MPN on BC variants (e.g. resolve at add-to-cart, or store id returned from CPQ only after validation).
4. **BS-2241 comment** — Should any flow **create/update BC products**, or keep BC **editor-owned** / minimal parents only?
5. **Imagery** — **Generic / 3D** tiles for dense variant grids still a product call.

### Note on Jira comments (BS-2501)

BS-2501 includes lengthy notes (e.g. flattening **BigCommerce** `product → variants[]`). Treat as **hints for a BC-shaped PLP**; they do not by themselves define how **configuration variants** are produced from **CPQ**. Reconcile with CPQ-sourced enumeration when architecture is chosen.

---

## Known Limitations / Open Questions

| # | Issue | Status |
|---|---|---|
| 0 | B2B stories call for **configuration-variant-level PLP** (many rows per **bike type** / ruleset), not one card per type | **Business alignment** — preferred **CPQ SoT** + BC **bike types**; PO exploring BC variant cache; PLP **lazy load**; **not PO-final** |
| 1 | `CPQ_RULESETS_JSON` must be manually curated with real ruleset names | Working as designed; the legacy system used a database for this |
| 2 | `isModelDefiningFeature` has not been verified against live Handlebar Type / Add Rack options (log truncation) | Open — needs larger log limit or debug endpoint |
| 3 | `productCode` (IPN) returned from CPQ Details is empty in observed responses | Open — the IPN caption in the Details section may differ from the expected strings |
| 4 | In-memory session store — sessions lost on BFF restart | Acceptable for POC; use Redis or a persistent store in production |
| 5 | `configureQuery.headerId` is passed to the client and used to re-start CPQ — in production this should come from the account/order context, not the client | Design gap; production would resolve headerId server-side from the authenticated user's order context |
| 6 | Finalise is a no-op in the POC — it calls `cpqFinalize` but does not connect to the TP2 order service | Next integration step |
| 7 | No authentication — the BFF is unprotected | POC only; production would require the TP2 auth middleware |

---

## Running Locally

```bash
cd tp2-bike-builder-poc
cp .env.example .env        # fill in CPQ_API_KEY, CPQ_INSTANCE_NAME, etc.
npm install
npm run dev                 # starts BFF on PORT (default 8787) + Vite client
```

Open `http://localhost:5173` for the client. The BFF is at `http://localhost:<PORT>`.

Set `CPQ_DEBUG_HTTP=1` in `.env` to see every Infor request/response in the server console (Authorization header is redacted).
