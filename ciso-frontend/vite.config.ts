import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy WebSocket requests
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
      // (optional) Proxy REST API calls to backend
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
