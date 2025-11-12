const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

module.exports = {
  ...sharedConfig,
  displayName: "auto-confirm",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  coverageDirectory: "../../coverage/libs/auto-confirm",
  moduleNameMapper: pathsToModuleNameMapper(
    { "@bitwarden/common/spec": ["libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/../../",
    },
  ),
};
