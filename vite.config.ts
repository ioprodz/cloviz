import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/client",
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "src/client"),
    },
  },
  server: {
    port: 3457,
    proxy: {
      "/api": "http://localhost:3456",
      "/ws": {
        target: "ws://localhost:3456",
        ws: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    emptyOutDir: true,
  },
});
