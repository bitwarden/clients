const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "dev-tools",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  coverageDirectory: "../../coverage/libs/dev-tools",
  moduleNameMapper: pathsToModuleNameMapper(
    // lets us use @bitwarden/common/spec in tests
    { "@bitwarden/common/spec": ["libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/../../",
    },
  ),
};
