/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
const integrationConfig = require("./jest.integration.config");

/** @type {import('jest').Config} */
module.exports = {
  ...integrationConfig,
  testMatch: ["**/*.e2e.integration.spec.ts"],
  testPathIgnorePatterns: ["/node_modules/"],
  testTimeout: 30000,
  moduleNameMapper: {
    ...integrationConfig.moduleNameMapper,
    // Force ws to use the Node.js build, not the browser stub
    "^ws$": "<rootDir>/../../node_modules/ws/index.js",
  },
};
