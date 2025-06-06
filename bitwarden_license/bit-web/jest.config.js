const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  setupFilesAfterEnv: ["../../apps/web/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    {
      "@bitwarden/common/spec": ["libs/common/spec"],
      "@bitwarden/common": ["libs/common/src/*"],
      "@bitwarden/admin-console/common": ["libs/admin-console/src/common"],
      ...(compilerOptions?.paths ?? {}),
    },
    {
      prefix: "<rootDir>/../../",
    },
  ),
};
