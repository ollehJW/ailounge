import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 9001,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:9002",
        changeOrigin: true
      }
    }
  }
});
