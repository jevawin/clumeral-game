import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const buildHash = Date.now().toString(36);

export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare(),
    {
      name: "sw-cache-bust",
      writeBundle(options) {
        const outDir = options.dir || "dist/client";
        const swPath = resolve(outDir, "sw.js");
        try {
          const content = readFileSync(swPath, "utf-8");
          writeFileSync(swPath, content.replace("__BUILD_HASH__", buildHash));
        } catch {
          // sw.js may not exist in server bundle
        }
      },
    },
  ],
});
