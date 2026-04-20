import path from "node:path";

import { defineConfig } from "vite";

// CJS factory — mirrors how bit-web/webpack.config.js requires apps/web/webpack.base.js.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildConfig } = require("../../apps/web/vite.base.js");

export default defineConfig(async () =>
  buildConfig({
    configName: "Commercial",
    app: {
      entry: path.resolve(__dirname, "src/main.ts"),
      entryModule: "bitwarden_license/bit-web/src/app/app.module#AppModule",
    },
    tsConfig: path.resolve(__dirname, "tsconfig.build.json"),
    importAliases: [
      { name: "@bitwarden/sdk-internal", alias: "@bitwarden/commercial-sdk-internal" },
    ],
  }),
);
