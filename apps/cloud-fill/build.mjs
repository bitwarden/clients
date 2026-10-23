import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");

// CLOUD_FILL_ALLOW_LOCALHOST=1 is for test builds only. It lets the origin policy accept
// http://localhost and http://127.0.0.1; a production build accepts https only.
const allowLocalhost = process.env.CLOUD_FILL_ALLOW_LOCALHOST === "1";

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: {
    background: join(here, "src/background.ts"),
    content: join(here, "src/content.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome116",
  platform: "browser",
  tsconfig: join(here, "tsconfig.json"),
  define: { __ALLOW_LOCALHOST__: JSON.stringify(allowLocalhost) },
  legalComments: "none",
  logLevel: "info",
});

await cp(join(here, "manifest.json"), join(dist, "manifest.json"));
