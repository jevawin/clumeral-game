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

        // sw.js is only emitted in the client bundle; skip quietly for server bundle.
        let swContent: string;
        try {
          swContent = readFileSync(swPath, "utf-8");
        } catch {
          return;
        }

        // Replace __BUILD_HASH__ token.
        swContent = swContent.replace("__BUILD_HASH__", buildHash);

        // Discover emitted bundle paths from the built index.html.
        const indexPath = resolve(outDir, "index.html");
        let indexHtml: string;
        try {
          indexHtml = readFileSync(indexPath, "utf-8");
        } catch {
          throw new Error(
            `sw-cache-bust: could not read ${indexPath} — refusing to ship an empty precache list`
          );
        }

        const assetMatches = indexHtml.match(/\/assets\/[^"' ]+\.(?:js|css)/g);
        const assetPaths = [...new Set(assetMatches ?? [])];

        if (assetPaths.length === 0) {
          throw new Error(
            "sw-cache-bust: no /assets bundles found in index.html — refusing to ship an empty precache list"
          );
        }

        // Replace the comment marker with the discovered paths.
        // The marker sits on its own line after the last real entry (which now
        // carries a trailing comma), so inject bare quoted paths — the marker's
        // own 2-space indent prefixes the first path; subsequent lines re-indent.
        const injection = assetPaths.map((p) => `'${p}'`).join(",\n  ");
        swContent = swContent.replace(
          "/* __PRECACHE_ASSETS__ */",
          injection
        );

        writeFileSync(swPath, swContent);
      },
    },
  ],
});
