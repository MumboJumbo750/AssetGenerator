import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  server: {
    port: Number(process.env.ASSETGEN_FRONTEND_PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.ASSETGEN_BACKEND_URL ?? "http://127.0.0.1:3030",
        changeOrigin: true,
      },
      "/data": {
        target: process.env.ASSETGEN_BACKEND_URL ?? "http://127.0.0.1:3030",
        changeOrigin: true,
      },
    },
  },
});
