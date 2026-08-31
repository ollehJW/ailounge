import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { createHmac } from "node:crypto";

const encodeJwtPart = (value) => Buffer
  .from(JSON.stringify(value))
  .toString("base64url");

const createDemoAccessToken = (userId, secret) => {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJwtPart({ alg: "HS256", typ: "JWT" });
  const payload = encodeJwtPart({
    sub: userId,
    user_id: userId,
    authority: "User",
    iat: now,
    exp: now + 60,
  });
  const signature = createHmac("sha256", secret)
    .update(header + "." + payload)
    .digest("base64url");
  return header + "." + payload + "." + signature;
};

const demoReadOnlyPlugin = {
  name: "ai-lounge-demo-read-only",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = String(request.url || "").split("?", 1)[0];
      const method = String(request.method || "GET").toUpperCase();
      const isReadOnlyMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
      if (path.startsWith("/api/admin") || (path.startsWith("/api/") && !isReadOnlyMethod)) {
        response.statusCode = 403;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ detail: "전시 모드에서는 조회 기능만 사용할 수 있습니다." }));
        return;
      }
      next();
    });
  },
  configurePreviewServer(server) {
    demoReadOnlyPlugin.configureServer(server);
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const demoUserId = env.VITE_DEMO_USER_ID || "33502";
  const demoJwtSecret = env.DEMO_PORTAL_JWT_SECRET || "";
  const demoReadOnly = env.VITE_DEMO_READ_ONLY === "true";
  const apiProxy = {
    "/api": {
      target: env.VITE_DEV_API_TARGET || "http://127.0.0.1:9004",
      changeOrigin: true,
      configure(proxy) {
        proxy.on("proxyReq", (proxyRequest) => {
          if (demoJwtSecret) {
            proxyRequest.setHeader(
              "Authorization",
              "Bearer " + createDemoAccessToken(demoUserId, demoJwtSecret),
            );
          }
        });
      },
    },
  };

  return {
    base: env.VITE_APP_BASE || env.VITE_ROUTER_BASE || "/",
    plugins: [...(demoReadOnly ? [demoReadOnlyPlugin] : []), vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 9003,
      strictPort: true,
      proxy: apiProxy,
    },
    preview: {
      host: "0.0.0.0",
      port: 9003,
      strictPort: true,
      proxy: apiProxy,
    },
  };
});
