import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * `PORT` must match the BFF (`server`) — same as in `.env`.
 * Previously this was hard-coded to 8787 while BFF used 8788, so the browser never hit your server.
 */
export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname);
  const env = loadEnv(mode, root, "");
  const bffPort = env.PORT || "8787";
  const proxyTarget = `http://127.0.0.1:${bffPort}`;
  const debugProxy =
    env.VITE_DEBUG_PROXY === "1" ||
    env.VITE_DEBUG_PROXY === "true" ||
    env.VITE_DEBUG_PROXY === "yes";

  return {
    plugins: [react(), tailwindcss()],
    root: path.resolve(__dirname, "client"),
    publicDir: path.resolve(__dirname, "client/public"),
    resolve: {
      alias: {
        "@client": path.resolve(__dirname, "client/src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          configure: (proxy) => {
            if (!debugProxy) return;
            proxy.on("proxyReq", (_proxyReq, req) => {
              console.log(`[vite-proxy] → ${req.method ?? "?"} ${req.url ?? ""}`);
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              console.log(`[vite-proxy] ← ${proxyRes.statusCode ?? "?"} ${req.url ?? ""}`);
            });
            proxy.on("error", (err) => {
              console.error(
                `[vite-proxy] error → ${proxyTarget} — is BFF running? PORT in .env should match (${bffPort}):`,
                err.message,
              );
            });
          },
        },
      },
    },
    build: {
      outDir: path.resolve(__dirname, "dist-client"),
      emptyOutDir: true,
    },
  };
});
