const { pathsToModuleNameMapper } = require("ts-jest");
const { createCjsPreset } = require("jest-preset-angular/presets");

const { compilerOptions } = require("../tsconfig.base");

const presetConfig = createCjsPreset({
  tsconfig: "<rootDir>/test/tsconfig.json",
  astTransformers: {
    before: ["<rootDir>/libs/shared/es2020-transformer.ts"],
  },
  diagnostics: false,
});

/** @type {import('jest').Config} */
module.exports = {
  ...presetConfig,
  displayName: "pqp tests",
  rootDir: "..",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],

  setupFilesAfterSetup: [],

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths ?? {}, {
    prefix: "<rootDir>/",
  }),

  collectCoverage: true,
  collectCoverageFrom: [
    "<rootDir>/libs/auth/src/common/services/pqp-auth/**/*.ts",
    "<rootDir>/apps/desktop/src/app/pqp/**/*.ts",
    "<rootDir>/apps/browser/src/popup/pqp/**/*.ts",
    "!**/*.spec.ts",
    "!**/*.test.ts",
    "!**/index.ts",
  ],
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageDirectory: "<rootDir>/coverage",

  maxWorkers: 3,
};
