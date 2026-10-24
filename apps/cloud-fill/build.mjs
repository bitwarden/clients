import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");

const testBuild = process.env.CLOUD_FILL_TEST_BUILD === "1";
const credentialSource = process.env.CLOUD_FILL_SOURCE ?? "relay";
const relayUrl = process.env.CLOUD_FILL_RELAY_URL ?? "wss://ap.lesspassword.dev";

if (!["relay", "static"].includes(credentialSource)) {
  throw new Error("CLOUD_FILL_SOURCE must be relay or static");
}
if (credentialSource === "static" && !testBuild) {
  throw new Error("The static credential source is only available in test builds");
}

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
  define: {
    __TEST_BUILD__: JSON.stringify(testBuild),
    __CREDENTIAL_SOURCE__: JSON.stringify(credentialSource),
    __RELAY_URL__: JSON.stringify(relayUrl),
    "import.meta.url": JSON.stringify("chrome-extension://unused/"),
  },
  legalComments: "none",
  logLevel: "info",
});

await cp(join(here, "manifest.json"), join(dist, "manifest.json"));
await cp(join(here, "wasm-remote/pkg/cloud_fill_remote_wasm_bg.wasm"), join(dist, "remote.wasm"));
