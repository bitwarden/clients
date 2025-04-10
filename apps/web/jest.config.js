const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: {
    // Replace ESM SDK with Node compatible SDK
    "@bitwarden/common/platform/services/sdk/default-sdk-client-factory":
      "<rootDir>/../../libs/common/spec/jest-sdk-client-factory",
    ...pathsToModuleNameMapper(
      {
        // lets us use @bitwarden/common/spec in web tests
        "@bitwarden/common/spec": ["../../libs/common/spec"],
        ...(compilerOptions?.paths ?? {}),
      },
      {
        prefix: "<rootDir>/",
      },
    ),
  },
};
