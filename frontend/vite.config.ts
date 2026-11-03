import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const characters = new URL("./public/assets/characters/", import.meta.url);
const digest = createHash("sha256");
for (const name of readdirSync(characters).sort()) {
  if (/\.(bin|png|json)$/.test(name)) digest.update(readFileSync(new URL(name, characters)));
}
export default defineConfig({
  define: { "import.meta.env.VITE_CHARACTER_REV": JSON.stringify(digest.digest("hex").slice(0, 16)) },
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
