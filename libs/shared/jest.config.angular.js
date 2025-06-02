/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
const { createCjsPreset } = require("jest-preset-angular/presets");

const presetConfig = createCjsPreset({
  tsconfig: "<rootDir>/tsconfig.spec.json",
  astTransformers: {
    before: ["<rootDir>/../../libs/shared/es2020-transformer.ts"],
  },
  diagnostics: {
    ignoreCodes: ["TS151001"],
  },
});

/** @type {import('jest').Config} */
module.exports = {
  ...presetConfig,
  testMatch: ["**/+(*.)+(spec).+(ts)"],

  testPathIgnorePatterns: [
    "/node_modules/", // default value
    ".*.type.spec.ts", // ignore type tests (which are checked at compile time and not run by jest)
  ],

  // Improves on-demand performance, for watches prefer 25%, overridable by setting --maxWorkers
  maxWorkers: "50%",
};
