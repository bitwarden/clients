const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    { "@bitwarden/common/spec": ["../../libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/",
    },
  ),
};
