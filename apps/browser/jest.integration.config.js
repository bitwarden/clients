/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
const baseConfig = require("./jest.config");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  testMatch: ["**/*.integration.spec.ts"],
  testPathIgnorePatterns: ["/node_modules/", "e2e\\.integration\\.spec\\.ts"],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    "^@bitwarden/sdk-internal$":
      process.env.WASM_NODE_PATH ||
      "<rootDir>/../../node_modules/@bitwarden/sdk-internal/node/bitwarden_wasm_internal.js",
  },
  testTimeout: 15000,
};
