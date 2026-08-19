import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_APP_BASE || env.VITE_ROUTER_BASE || "/",
    plugins: [vue()],
    server: {
      host: "0.0.0.0",
      port: 9001,
      proxy: {
        "/ai-lounge-api": {
          target: "http://127.0.0.1:9002",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai-lounge-api/, "/api")
        }
      }
    }
  };
});
