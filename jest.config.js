const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig.base");

/** @type {import('jest').Config} */
module.exports = {
  reporters: ["default", "jest-junit"],

  collectCoverage: true,
  // Ensure we collect coverage from files without tests
  collectCoverageFrom: ["src/**/*.ts"],
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
    "<rootDir>/bitwarden_license/bit-browser/jest.config.js",
    "<rootDir>/bitwarden_license/bit-cli/jest.config.js",
    "<rootDir>/bitwarden_license/bit-common/jest.config.js",
    "<rootDir>/bitwarden_license/bit-web/jest.config.js",

    "<rootDir>/libs/admin-console/jest.config.js",
    "<rootDir>/libs/angular/jest.config.js",
    "<rootDir>/libs/assets/jest.config.js",
    "<rootDir>/libs/auth/jest.config.js",
    "<rootDir>/libs/billing/jest.config.js",
    "<rootDir>/libs/client-type/jest.config.js",
    "<rootDir>/libs/common/jest.config.js",
    "<rootDir>/libs/components/jest.config.js",
    "<rootDir>/libs/core-test-utils/jest.config.js",
    "<rootDir>/libs/dirt/card/jest.config.js",
    "<rootDir>/libs/eslint/jest.config.js",
    "<rootDir>/libs/guid/jest.config.js",
    "<rootDir>/libs/importer/jest.config.js",
    "<rootDir>/libs/key-management/jest.config.js",
    "<rootDir>/libs/key-management-ui/jest.config.js",
    "<rootDir>/libs/logging/jest.config.js",
    "<rootDir>/libs/messaging-internal/jest.config.js",
    "<rootDir>/libs/messaging/jest.config.js",
    "<rootDir>/libs/node/jest.config.js",
    "<rootDir>/libs/platform/jest.config.js",
    "<rootDir>/libs/serialization/jest.config.js",
    "<rootDir>/libs/state-test-utils/jest.config.js",
    "<rootDir>/libs/state/jest.config.js",
    "<rootDir>/libs/storage-core/jest.config.js",
    "<rootDir>/libs/storage-test-utils/jest.config.js",
    "<rootDir>/libs/tools/export/vault-export/vault-export-core/jest.config.js",
    "<rootDir>/libs/tools/export/vault-export/vault-export-ui/jest.config.js",
    "<rootDir>/libs/tools/generator/core/jest.config.js",
    "<rootDir>/libs/tools/generator/components/jest.config.js",
    "<rootDir>/libs/tools/generator/extensions/history/jest.config.js",
    "<rootDir>/libs/tools/generator/extensions/legacy/jest.config.js",
    "<rootDir>/libs/tools/generator/extensions/navigation/jest.config.js",
    "<rootDir>/libs/tools/send/send-ui/jest.config.js",
    "<rootDir>/libs/user-core/jest.config.js",
    "<rootDir>/libs/vault/jest.config.js",
  ],

  // Workaround for a memory leak that crashes tests in CI:
  // https://github.com/facebook/jest/issues/9430#issuecomment-1149882002
  // Also anecdotally improves performance when run locally
  maxWorkers: 3,
};
