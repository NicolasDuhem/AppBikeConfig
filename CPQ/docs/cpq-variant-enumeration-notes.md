# CPQ variant enumeration — live probe notes (Mar 2026)

Working notes from local spikes against **Brompton TRN** tenant. Confirm against official Infor docs before production.

## ProductConfiguratorUI JSON — `StartConfiguration`

- **URL (sample):** `https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json/StartConfiguration`
- **Auth:** `Authorization: ApiKey <key>` (same as POC BFF); `Accept-Language` / `Content-Type: application/json` per [server/src/lib/cpq/client.ts](../server/src/lib/cpq/client.ts).
- **Result:** `HTTP 200`; `sessionID` present; JSON body **very large** (hundreds of KB per call). Plan PLP batching with **low concurrency** and **slim DTOs** after normalisation.
- **Repeatable probe** (from `tp2-bike-builder-poc`, loads `.env`):

```bash
npx tsx -e "
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { buildStartPayload, cpqStartConfiguration, parseCpqIntegrationParametersFromEnv } from './server/src/lib/cpq/client.ts';
(async () => {
  const detailId = randomUUID().replace(/-/g, '');
  const payload = buildStartPayload({
    instance: process.env.CPQ_INSTANCE_NAME ?? '',
    application: process.env.CPQ_APPLICATION_NAME ?? '',
    profile: process.env.CPQ_PROFILE ?? 'Default',
    namespace: process.env.CPQ_NAMESPACE ?? '',
    ruleset: process.env.CPQ_RULESET ?? '',
    headerId: process.env.CPQ_HEADER_ID ?? '',
    detailId,
    variantKey: process.env.CPQ_SPIKE_VARIANT_KEY ?? undefined,
    integrationParameters: parseCpqIntegrationParametersFromEnv(),
  });
  const res = await cpqStartConfiguration(payload);
  console.log('status', res.status, 'sessionID', Boolean((res.data as { sessionID?: string })?.sessionID));
})();
"
```

Set `CPQ_SPIKE_VARIANT_KEY` when testing a named CPQ variant from Design Studio.

## `configurator/v4/configurations/{id}/output` (PDF doc)

- **Host tested:** `configurator.eu1.inforcloudsuite.com`
- **Auth:** same **ApiKey** as ProductConfiguratorUI.
- **Result:** `GET /configurator/v4/configurations/{id}/output` → **400** HTML (*Infor OS Federation Hub Error*); alternate path **404**.
- **Implication:** Documented **OAuth Bearer** v4 surface is **not** interchangeable with the **ApiKey** ProductConfiguratorUI client in this POC. Defer v4 output until Infor confirms **token type + base URL** for the tenant.

## Rulesets from the legacy beta SQL database

You **can** query the current beta app database for **valid bike types** (CPQ ruleset names, namespace, header) — the same data the legacy bike builder loads from `CpqBikeType` / account mappings.

| Source | What you get |
|--------|----------------|
| `frt.CpqBikeType` | `Rulset` (ruleset name), `Namespace`, `HeaderID`, `Name`, `IsActive`, `IsDeleted`, `BikeTypeCategory`, `AlternativeRuleset`, etc. |
| Join `frt.ModelType` | `ModelType.Name` often helps infer C/P/G/T line for POC `line` |

Use the query in [`scripts/export-rulesets-from-legacy-db.sql`](../scripts/export-rulesets-from-legacy-db.sql), paste results into `CPQ_RULESETS_JSON`, and set **`line`** + **`isElectric`** so catalogue categories match (or rely on naming conventions).

**You cannot** get **Design Studio `variantKey`** values from this database — they are not stored in Trade SQL; only Infor CPQ / Design Studio (or exports from there) holds that list. For many PLP rows per ruleset, still use `variantKeys` / `CPQ_GLOBAL_VARIANT_KEYS_JSON` once keys are known from CPQ.

## Next steps for PLP

1. Obtain **`variantKey`** list per ruleset (CPQ Design Studio / export / Infor).
2. Inspect **normalised Details** / features for **EAN** (full responses, not truncated logs).
3. Optional: validate **`GET /api/v1/configurator/models`** only if Infor confirms URL + credentials for this tenant.
