/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
const integrationConfig = require("./jest.integration.config");

/** @type {import('jest').Config} */
module.exports = {
  ...integrationConfig,
  testMatch: ["**/*.e2e.integration.spec.ts"],
  testTimeout: 30000,
};
