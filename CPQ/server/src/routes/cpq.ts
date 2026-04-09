import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import {
  buildStartPayload,
  cpqConfigure,
  cpqFinalize,
  cpqStartConfiguration,
  describeCpqStartFailure,
  isCpqHttpDebugEnabled,
  isMockMode,
  logCpqDebug,
  mergeCpqIntegrationParameters,
  parseCpqIntegrationParametersFromEnv,
} from "../lib/cpq/client.js";
import {
  catalogueQuerySchema,
  configurationVariantsQuerySchema,
  configureBodySchema,
  startBodySchema,
} from "../lib/cpq/contracts.js";
import { buildCatalogueResponse } from "../lib/cpq/catalogue.js";
import {
  buildConfigurationVariantsResponse,
  DEV_LOCATION_HEADER,
} from "../lib/cpq/configuration-variants.js";
import {
  applyMockSelections,
  mockNormalizedState,
  normalizeConfiguratorResponse,
  variantsFromNormalizedState,
} from "../lib/cpq/mappers.js";
import {
  clearSession,
  createBrowserSession,
  getSession,
  setCpqSession,
  touchSession,
} from "../lib/cpq/session-store.js";

const COOKIE = "bb_poc_session";

function readBrowserToken(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const m = raw.split(";").map((s) => s.trim());
  for (const part of m) {
    if (part.startsWith(`${COOKIE}=`)) {
      return part.slice(COOKIE.length + 1);
    }
  }
  return undefined;
}

function setBrowserCookie(res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 4}`,
  );
}

function ensureBrowserToken(req: Request, res: Response): string {
  let t = readBrowserToken(req);
  if (!t) {
    t = createBrowserSession();
    setBrowserCookie(res, t);
  }
  return t;
}

export const cpqRouter = Router();


cpqRouter.get("/configuration-variants", async (req: Request, res: Response) => {
  try {
    const parsed = configurationVariantsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid query",
        details: parsed.error.flatten(),
      });
    }
    const loc = typeof req.headers[DEV_LOCATION_HEADER] === "string" ? req.headers[DEV_LOCATION_HEADER] : undefined;
    const out = await buildConfigurationVariantsResponse({
      bikeTypeId: parsed.data.bikeTypeId,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      customerLocationOverride: loc,
    });
    if (!out.ok) {
      return res.status(404).json(out);
    }
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "configuration-variants failed" });
  }
});

cpqRouter.get("/catalogue", async (req: Request, res: Response) => {
  try {
    const parsed = catalogueQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid query",
        details: parsed.error.flatten(),
      });
    }
    const out = await buildCatalogueResponse(parsed.data.category);
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "catalogue failed" });
  }
});

cpqRouter.use((req: Request, res: Response, next) => {
  if (!isCpqHttpDebugEnabled()) return next();
  const body = req.body && typeof req.body === "object" ? req.body : undefined;
  const bodyKeys = body ? Object.keys(body as object).length : 0;
  console.log(`[BFF←client] ${req.method} ${req.originalUrl}${bodyKeys ? ` (body keys: ${bodyKeys})` : ""}`);
  return next();
});

cpqRouter.post("/start", async (req: Request, res: Response) => {
  try {
    const parsed = startBodySchema.safeParse(req.body ?? {});
    const body = parsed.success ? parsed.data : {};

    const browser = ensureBrowserToken(req, res);
    const detailId = body.detailId?.trim() || randomUUID().replace(/-/g, "");
    const headerId = body.headerId?.trim() || process.env.CPQ_HEADER_ID || "";

    if (isMockMode()) {
      logCpqDebug("mock: skipping StartConfiguration — no outbound HTTP to Infor");
      const norm = mockNormalizedState();
      setCpqSession(browser, norm.sessionId);
      return res.json({
        ok: true,
        mock: true,
        state: norm,
        variants: variantsFromNormalizedState(norm),
      });
    }

    const integrationParameters = mergeCpqIntegrationParameters(
      parseCpqIntegrationParametersFromEnv(),
      body.integrationParameters?.map((p) => ({
        name: p.name,
        simpleValue: p.simpleValue,
        isNull: p.isNull,
        type: p.type,
      })),
    );

    const ruleset = body.partName?.trim() || process.env.CPQ_RULESET || "";
    const namespace = body.partNamespace?.trim() || process.env.CPQ_NAMESPACE || "";

    if (!ruleset) {
      return res.status(400).json({ ok: false, error: "Missing CPQ ruleset: provide partName or set CPQ_RULESET" });
    }
    if (!namespace) {
      return res.status(400).json({ ok: false, error: "Missing CPQ namespace: provide partNamespace or set CPQ_NAMESPACE" });
    }
    if (!process.env.CPQ_INSTANCE_NAME?.trim()) {
      return res.status(500).json({ ok: false, error: "Missing CPQ_INSTANCE_NAME env var" });
    }
    if (!process.env.CPQ_APPLICATION_NAME?.trim()) {
      return res.status(500).json({ ok: false, error: "Missing CPQ_APPLICATION_NAME env var" });
    }

    const payload = buildStartPayload({
      instance: process.env.CPQ_INSTANCE_NAME,
      application: process.env.CPQ_APPLICATION_NAME,
      profile: process.env.CPQ_PROFILE || "Default",
      namespace,
      ruleset,
      headerId,
      detailId,
      sourceHeaderId: body.sourceHeaderId,
      sourceDetailId: body.sourceDetailId,
      variantKey: body.variantKey,
      integrationParameters,
    });

    const { status, data } = await cpqStartConfiguration(payload);
    if (status < 200 || status >= 300) {
      const cpqHint = describeCpqStartFailure(data);
      return res.status(502).json({
        ok: false,
        error: "CPQ StartConfiguration failed",
        cpqStatus: status,
        cpqBody: data,
        ...(cpqHint ? { cpqHint } : {}),
      });
    }

    const norm = normalizeConfiguratorResponse(data);
    if (!norm.sessionId) {
      return res.status(502).json({ ok: false, error: "Missing sessionID in CPQ response", cpqBody: data });
    }
    setCpqSession(browser, norm.sessionId);
    return res.json({
      ok: true,
      state: norm,
      variants: variantsFromNormalizedState(norm),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "start failed" });
  }
});

cpqRouter.post("/configure", async (req: Request, res: Response) => {
  try {
    const browser = ensureBrowserToken(req, res);
    const sess = getSession(browser);
    if (!sess) {
      return res.status(400).json({ ok: false, error: "No session; call /api/cpq/start first" });
    }

    let body: ReturnType<(typeof configureBodySchema)["parse"]>;
    try {
      body = configureBodySchema.parse(req.body ?? {});
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({ ok: false, error: "Invalid body", details: e.flatten() });
      }
      throw e;
    }

    if (isMockMode()) {
      logCpqDebug("mock: skipping configure — no outbound HTTP to Infor");
      const base = mockNormalizedState();
      const next = applyMockSelections(base, body.selections);
      touchSession(browser);
      return res.json({
        ok: true,
        mock: true,
        clientRequestId: body.clientRequestId,
        state: next,
        variants: variantsFromNormalizedState(next),
      });
    }

    const configurePayload = {
      sessionID: sess.cpqSessionId,
      selections: body.selections.map((s) => ({ id: s.id, value: s.value })),
    };

    const { status, data } = await cpqConfigure(configurePayload);
    if (status < 200 || status >= 300) {
      return res.status(502).json({
        ok: false,
        error: "CPQ configure failed",
        cpqStatus: status,
        cpqBody: data,
      });
    }

    const norm = normalizeConfiguratorResponse(data);
    touchSession(browser);
    return res.json({
      ok: true,
      clientRequestId: body.clientRequestId,
      state: norm,
      variants: variantsFromNormalizedState(norm),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "configure failed" });
  }
});

cpqRouter.post("/finalize", async (req: Request, res: Response) => {
  try {
    const browser = readBrowserToken(req) ?? ensureBrowserToken(req, res);
    const sess = getSession(browser);
    if (!sess) {
      return res.status(400).json({ ok: false, error: "No session" });
    }

    if (isMockMode()) {
      logCpqDebug("mock: skipping FinalizeConfiguration — no outbound HTTP to Infor");
      return res.json({ ok: true, mock: true, message: "Finalized (mock)" });
    }

    const { status, data } = await cpqFinalize(sess.cpqSessionId);
    if (status < 200 || status >= 300) {
      return res.status(502).json({
        ok: false,
        error: "CPQ finalize failed",
        cpqStatus: status,
        cpqBody: data,
      });
    }
    return res.json({ ok: true, cpq: data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "finalize failed" });
  }
});

cpqRouter.post("/reset", (req: Request, res: Response) => {
  const browser = readBrowserToken(req);
  if (browser) clearSession(browser);
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res.json({ ok: true });
});
