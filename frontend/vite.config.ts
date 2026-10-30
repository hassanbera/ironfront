import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/ws": { target: "ws://127.0.0.1:8787", ws: true },
      "/health": "http://127.0.0.1:8787",
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        drill: fileURLToPath(new URL("./drill.html", import.meta.url)),
        crowd: fileURLToPath(new URL("./crowd-lab.html", import.meta.url)),
      },
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
