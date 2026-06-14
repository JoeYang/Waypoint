import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web dev server. The inbox API + its WebSocket stream live on the server package
// (default :8849); proxy /v1 there — `ws: true` upgrades the /v1/projects/:p/stream
// socket too — so the app speaks same-origin relative paths in every environment.
const API_TARGET = process.env.WAYPOINT_HTTP_URL ?? "http://localhost:8849";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WAYPOINT_WEB_PORT ?? "5173"),
    proxy: {
      "/v1": { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
});
