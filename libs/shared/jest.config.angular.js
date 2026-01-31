/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
const { createCjsPreset } = require("jest-preset-angular/presets");

const presetConfig = createCjsPreset({
  tsconfig: "<rootDir>/tsconfig.spec.json",
  diagnostics: {
    ignoreCodes: ["TS151001"],
  },
});

/** @type {import('jest').Config} */
module.exports = {
  ...presetConfig,
  testMatch: ["**/+(*.)+(spec).+(ts|js|mjs|cjs)"],
  testPathIgnorePatterns: [
    "/node_modules/", // default value
    "\\.type\\.spec\\.ts", // ignore type tests (which are checked at compile time and not run by jest)
    "\\.play\\.spec\\.ts", // ignore playwright tests
  ],

  // Improves on-demand performance, for watches prefer 25%, overridable by setting --maxWorkers
  maxWorkers: "50%",
};
