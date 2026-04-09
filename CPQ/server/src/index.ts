import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCpqHttpDebugEnabled, isMockMode } from "./lib/cpq/client.js";
import { cpqRouter } from "./routes/cpq.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(rootDir, ".env") });

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tp2-bike-builder-poc-bff" });
});

app.use("/api/cpq", cpqRouter);

app.listen(port, () => {
  console.log(`BFF listening on http://127.0.0.1:${port}`);
  if (!process.env.CPQ_API_KEY) {
    console.warn(
      "[tp2-bike-builder-poc] CPQ_API_KEY not set — running in MOCK CPQ mode. Set CPQ_API_KEY (+ URLs) for live Infor CPQ.",
    );
  }
  if (isCpqHttpDebugEnabled()) {
    console.warn(
      "[tp2-bike-builder-poc] CPQ_DEBUG_HTTP is on — logging BFF→Infor requests (Authorization redacted).",
    );
    if (isMockMode()) {
      console.warn(
        "[tp2-bike-builder-poc] CPQ is in MOCK mode — no outbound Infor HTTP. Set CPQ_API_KEY and CPQ_MOCK=0, then restart BFF.",
      );
    }
  }
});
