import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxy = {
    "/api": {
      target: env.VITE_DEV_API_TARGET || "http://127.0.0.1:9002",
      changeOrigin: true,
    },
  };

  return {
    base: env.VITE_APP_BASE || env.VITE_ROUTER_BASE || "/",
    plugins: [vue()],
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
