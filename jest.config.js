const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig");

/** @type {import('jest').Config} */
module.exports = {
  reporters: ["default", "jest-junit"],

  collectCoverage: true,
  coverageReporters: ["html", "lcov"],
  coverageDirectory: "coverage",

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/",
  }),
  projects: [
    "<rootDir>/apps/browser/jest.config.js",
    "<rootDir>/apps/cli/jest.config.js",
    "<rootDir>/apps/desktop/jest.config.js",
    "<rootDir>/apps/web/jest.config.js",
    "<rootDir>/bitwarden_license/bit-web/jest.config.js",

    "<rootDir>/libs/angular/jest.config.js",
    "<rootDir>/libs/auth/jest.config.js",
    "<rootDir>/libs/common/jest.config.js",
    "<rootDir>/libs/components/jest.config.js",
    "<rootDir>/libs/exporter/jest.config.js",
    "<rootDir>/libs/importer/jest.config.js",
    "<rootDir>/libs/node/jest.config.js",
    "<rootDir>/libs/vault/jest.config.js",
  ],

  // Workaround for a memory leak that crashes tests in CI:
  // https://github.com/facebook/jest/issues/9430#issuecomment-1149882002
  // Also anecdotally improves performance when run locally
  maxWorkers: 3,
};
