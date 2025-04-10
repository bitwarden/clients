const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../shared/tsconfig.spec");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "libs/key management tests",
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    // lets us use @bitwarden/common/spec in tests
    { "@bitwarden/common/spec": ["../common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/",
    },
  ),
};
