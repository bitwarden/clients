const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.ts");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/../../apps/cli/test.setup.ts"],
  transformIgnorePatterns: ["node_modules/(?!(chalk|lowdb|steno)/)"],
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.spec.json",
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    "^#ansi-styles$":
      "<rootDir>/../../apps/cli/node_modules/chalk/source/vendor/ansi-styles/index.js",
    "^#supports-color$":
      "<rootDir>/../../apps/cli/node_modules/chalk/source/vendor/supports-color/index.js",
    "@bitwarden/common/platform/services/sdk/default-sdk-client-factory":
      "<rootDir>/../../libs/common/spec/jest-sdk-client-factory",
    ...pathsToModuleNameMapper(compilerOptions?.paths || {}, {
      prefix: "<rootDir>/../../",
    }),
  },
};
