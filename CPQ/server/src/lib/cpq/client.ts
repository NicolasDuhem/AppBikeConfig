import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

function getEnv(name: string, fallback = ""): string {
  return process.env[name]?.trim() ?? fallback;
}

const DEBUG_PREFIX = "[CPQ→Infor]";

/** When true, log outbound HTTP to Infor (never logs raw API keys). */
export function isCpqHttpDebugEnabled(): boolean {
  const v = getEnv("CPQ_DEBUG_HTTP", "");
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

/** Extra debug lines when CPQ_DEBUG_HTTP is on (e.g. mock skip, hints). */
export function logCpqDebug(message: string): void {
  if (!isCpqHttpDebugEnabled()) return;
  console.log(`${DEBUG_PREFIX} ${message}`);
}

function redactHeaders(h: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  for (const [k, v] of Object.entries(h)) {
    const key = k.toLowerCase();
    if (key === "authorization") {
      const s = String(v ?? "");
      out[k] = s.startsWith("ApiKey ") ? "ApiKey [REDACTED]" : "[REDACTED]";
    } else {
      out[k] = String(v ?? "");
    }
  }
  return out;
}

function safeJsonPreview(data: unknown, maxLen = 12_000): string {
  try {
    const s = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}\n… [truncated ${s.length - maxLen} chars]`;
  } catch {
    return "[unserializable body]";
  }
}

function attachCpqDebugInterceptors(client: AxiosInstance): void {
  if (!isCpqHttpDebugEnabled()) return;

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const start = Date.now();
    (config as InternalAxiosRequestConfig & { _cpqDebugStart?: number })._cpqDebugStart = start;
    const url = config.url ?? "";
    const method = (config.method ?? "GET").toUpperCase();
    console.log(`${DEBUG_PREFIX} → ${method} ${url}`);
    console.log(`${DEBUG_PREFIX}   headers:`, redactHeaders(config.headers as Record<string, unknown>));
    if (config.data !== undefined) {
      console.log(`${DEBUG_PREFIX}   body:\n${safeJsonPreview(config.data)}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const cfg = response.config as InternalAxiosRequestConfig & { _cpqDebugStart?: number };
      const ms = cfg._cpqDebugStart != null ? Date.now() - cfg._cpqDebugStart : undefined;
      const url = response.config.url ?? "";
      console.log(
        `${DEBUG_PREFIX} ← ${response.status} ${url}${ms != null ? ` (${ms}ms)` : ""}`,
      );
      console.log(`${DEBUG_PREFIX}   response body:\n${safeJsonPreview(response.data)}`);
      return response;
    },
    (error) => {
      if (axios.isAxiosError(error)) {
        const cfg = error.config as (InternalAxiosRequestConfig & { _cpqDebugStart?: number }) | undefined;
        const ms = cfg?._cpqDebugStart != null ? Date.now() - cfg._cpqDebugStart : undefined;
        const url = cfg?.url ?? "";
        console.error(
          `${DEBUG_PREFIX} ✗ ${error.message} ${url}${ms != null ? ` (${ms}ms)` : ""}`,
        );
        if (error.response) {
          console.error(`${DEBUG_PREFIX}   status: ${error.response.status}`);
          console.error(`${DEBUG_PREFIX}   response body:\n${safeJsonPreview(error.response.data)}`);
        }
      } else {
        console.error(`${DEBUG_PREFIX} ✗`, error);
      }
      return Promise.reject(error);
    },
  );
}

export function isMockMode(): boolean {
  const m = getEnv("CPQ_MOCK", "");
  if (m === "1" || m.toLowerCase() === "true") return true;
  if (m === "0" || m.toLowerCase() === "false") return false;
  if (!getEnv("CPQ_API_KEY")) return true;
  return false;
}

export function createCpqHttp(): AxiosInstance {
  const apiKey = getEnv("CPQ_API_KEY");
  /** Sent to Infor; may affect UI strings. Ruleset engine culture is usually `inputParameters.cultureName` (see CPQ_CULTURE_NAME). */
  const acceptLanguage = getEnv("CPQ_ACCEPT_LANGUAGE", "en-GB");
  const client = axios.create({
    timeout: 120_000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": acceptLanguage,
      ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
    },
    validateStatus: () => true,
  });
  attachCpqDebugInterceptors(client);
  return client;
}

export async function cpqStartConfiguration(body: unknown): Promise<{ status: number; data: unknown }> {
  const url = getEnv(
    "CPQ_START_CONFIGURATION_URL",
    "https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json/StartConfiguration",
  );
  const client = createCpqHttp();
  const res = await client.post(url, body);
  return { status: res.status, data: res.data };
}

export async function cpqConfigure(body: unknown): Promise<{ status: number; data: unknown }> {
  const url = getEnv(
    "CPQ_CONFIGURE_URL",
    "https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json/configure",
  );
  const client = createCpqHttp();
  const res = await client.post(url, body);
  return { status: res.status, data: res.data };
}

export type CpqIntegrationParameter = {
  name: string;
  simpleValue?: string;
  isNull?: boolean;
  type?: string;
};

/** Optional JSON array merged into StartConfiguration (request body overrides same `name`). Legacy Trade sends AccountType, CurrencyCode, Company, CustomerLocation. */
export function parseCpqIntegrationParametersFromEnv(): CpqIntegrationParameter[] {
  const raw = getEnv("CPQ_INTEGRATION_PARAMETERS_JSON", "").trim();
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    logCpqDebug("CPQ_INTEGRATION_PARAMETERS_JSON is not valid JSON — ignoring");
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: CpqIntegrationParameter[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    if (!name) continue;
    out.push({
      name,
      simpleValue: typeof o.simpleValue === "string" ? o.simpleValue : undefined,
      isNull: typeof o.isNull === "boolean" ? o.isNull : undefined,
      type: typeof o.type === "string" ? o.type : undefined,
    });
  }
  return out;
}

export function mergeCpqIntegrationParameters(
  fromEnv: CpqIntegrationParameter[],
  fromRequest: CpqIntegrationParameter[] | undefined,
): CpqIntegrationParameter[] {
  const map = new Map<string, CpqIntegrationParameter>();
  for (const p of fromEnv) map.set(p.name, { ...p });
  for (const p of fromRequest ?? []) map.set(p.name, { ...p });
  return [...map.values()];
}

/** Human-readable hint for BFF JSON when CPQ returns a known exception body (no secrets). */
export function describeCpqStartFailure(data: unknown): string | undefined {
  const d = data as { ExceptionType?: string; Message?: string } | undefined;
  const t = d?.ExceptionType ?? "";
  const msg = d?.Message ?? "";
  if (!t) return undefined;
  if (t.includes("RulesetNotFoundException")) {
    return (
      "Infor reports this ruleset is not published for this tenant/culture. " +
      "Confirm CPQ_INSTANCE_NAME and CPQ_APPLICATION_NAME match the API key, and that namespace/part/profile exist in CPQ Design Studio. " +
      "Trade Platform uses frt.CpqBikeType (Rulset, Namespace, HeaderID) per bike type — set CPQ_HEADER_ID to that HeaderID when it is not Simulator."
    );
  }
  if (t.includes("RuleEngineException") && msg.includes("FetchFirstValueFromOptionList")) {
    return (
      "CPQ rules ran during StartConfiguration but an option list was empty (rule tried to pick a default). " +
      "Legacy Trade always sends integration parameters (AccountType, CurrencyCode, Company, CustomerLocation). " +
      "Set CPQ_INTEGRATION_PARAMETERS_JSON in .env with values that match a real account/session, or fix the rule/option-list data in CPQ Design Studio."
    );
  }
  if (t.includes("RuleEngineException")) {
    return (
      "CPQ rule execution failed during StartConfiguration. Check the Message for rule id and component; " +
      "this is usually CPQ model/data or missing integration context — not a BFF transport issue."
    );
  }
  return undefined;
}

export async function cpqFinalize(sessionId: string): Promise<{ status: number; data: unknown }> {
  const url = getEnv(
    "CPQ_FINALIZE_CONFIGURATION_URL",
    "https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json/FinalizeConfiguration",
  );
  const client = createCpqHttp();
  const res = await client.post(url, { sessionID: sessionId });
  return { status: res.status, data: res.data };
}

export function buildStartPayload(opts: {
  instance: string;
  application: string;
  profile: string;
  namespace: string;
  ruleset: string;
  mode?: number;
  headerId: string;
  detailId: string;
  sourceHeaderId?: string;
  sourceDetailId?: string;
  variantKey?: string;
  integrationParameters?: { name: string; simpleValue?: string; isNull?: boolean; type?: string }[];
}) {
  const mode = opts.mode ?? 0;
  /** Optional; runtime tests showed RulesetNotFound message still referenced en-US when this was set — do not rely on it to fix missing rulesets. */
  const cultureNameOpt = getEnv("CPQ_CULTURE_NAME", "").trim();
  return {
    inputParameters: {
      mode,
      profile: opts.profile,
      variantKey: opts.variantKey ?? "",
      ...(cultureNameOpt ? { cultureName: cultureNameOpt } : {}),
      application: {
        instance: opts.instance,
        name: opts.application,
      },
      part: {
        namespace: opts.namespace,
        name: opts.ruleset,
      },
      headerDetail: {
        headerId: opts.headerId,
        detailId: opts.detailId,
      },
      sourceHeaderDetail: {
        headerId: opts.sourceHeaderId ?? "",
        detailId: opts.sourceDetailId ?? "",
      },
      integrationParameters: (opts.integrationParameters ?? []).map((p) => ({
        name: p.name,
        simpleValue: p.simpleValue ?? "",
        isNull: p.isNull ?? false,
        type: p.type ?? "string",
      })),
      // Infor v4 model validation requires this array (legacy InputParameters.RapidOptions in Brompton.DTO)
      rapidOptions: [] as string[],
    },
  };
}
