# TP 2.0 Bike Builder POC

Isolated prototype in the legacy Trade Platform repo: **Vite + React** frontend and a lightweight **Express** BFF that calls Infor CPQ v4 JSON endpoints (`StartConfiguration`, `configure`, `FinalizeConfiguration`).

## Prerequisites

- Node.js 20+

## Setup

```bash
cd tp2-bike-builder-poc
npm install
cp .env.example .env
```

### CPQ modes

- **Mock (default)** — If `CPQ_API_KEY` is not set, the BFF uses an in-memory mock configurator so the UI runs without Infor credentials.
- **Live** — Set `CPQ_API_KEY`, optional URLs in `.env`, and `CPQ_MOCK=0`.

### Debug: what logs where

| What you want to see | Where it runs | Flag / note |
|---------------------|---------------|-------------|
| **Browser → BFF** (`/api/cpq/...`) | Vite dev server terminal | `VITE_DEBUG_PROXY=1` — lines prefixed `[vite-proxy]` |
| **BFF received a CPQ route** | BFF terminal | `CPQ_DEBUG_HTTP=1` — lines prefixed `[BFF←client]` |
| **BFF → Infor CPQ** (actual outbound HTTP) | BFF terminal only | `CPQ_DEBUG_HTTP=1` — lines prefixed `[CPQ→Infor]` |

**Important:** The Vite proxy only forwards the browser’s `/api` calls to the BFF. **Infor is called only from the BFF process**, so **`[CPQ→Infor]` never appears in the Vite/client terminal** — only in the **server** stream of `npm run dev` (the `[server]` labelled lines).

**PORT:** The Vite proxy target uses `PORT` from `.env` (defaults `8787`). It must match the BFF listen port. If they differ, the UI may hit the wrong process and you will see no CPQ logs.

**Mock mode:** If `CPQ_API_KEY` is missing or mock is forced, the BFF does not call Infor. With `CPQ_DEBUG_HTTP=1` you will see `[CPQ→Infor] mock: skipping …` and the startup warning about mock mode.

**`Ruleset … en-US not found` (500):** Infor resolves rulesets per locale. This BFF sends **`Accept-Language`** (default **`en-GB`** via `CPQ_ACCEPT_LANGUAGE`) on every CPQ request. If you still see `RulesetNotFoundException`, confirm in CPQ Design Studio that the profile/namespace/ruleset exists for that tenant and locale, or try `CPQ_ACCEPT_LANGUAGE=en-US` if your environment only publishes US English.

Set `CPQ_DEBUG_HTTP=1` (or `true`) in `.env` and restart. Logs include URL, method, redacted `Authorization` (`ApiKey [REDACTED]`), bodies (truncated), status, and duration. Disable in shared or production environments.

## Development

Runs Vite (port **5173**) and the BFF (port **8787**). The dev server proxies `/api` to the BFF.

```bash
npm run dev
```

Open `http://localhost:5173`.

## Production-style build

```bash
npm run build
node dist-server/index.js
```

Serve `dist-client/` as static files from your reverse proxy or Azure Static Web Apps; run the BFF separately with `PORT` and CPQ env vars.

## UX behaviour (POC)

- **Debounced batching** — Multiple dropdown changes within ~280ms are sent as one `configure` call with multiple `selections`.
- **Optimistic UI** — Selected value updates immediately; review panel shows a light refresh state while the BFF round-trip completes.
- **Stale request handling** — In-flight configure requests are aborted when a newer batch is sent.

## API (BFF)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/cpq/start` | Start CPQ session; sets HttpOnly session cookie |
| POST | `/api/cpq/configure` | Body `{ selections: [{ id, value }], clientRequestId? }` |
| POST | `/api/cpq/finalize` | Finalize current session |
| POST | `/api/cpq/reset` | Clear POC session cookie and server session |
| GET | `/api/health` | Health check |

## Legacy reference only

Existing Trade Platform CPQ wiring (Angular + WCF + `Configurator.cs`) is **not** used by this folder; it remains a behavioural reference only.
