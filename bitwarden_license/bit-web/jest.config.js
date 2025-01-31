const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["../../apps/web/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    {
      "@bitwarden/common/spec": ["../../libs/common/spec"],
      "@bitwarden/common": ["../../libs/common/src/*"],
      "@bitwarden/admin-console/common": ["<rootDir>/libs/admin-console/src/common"],
      ...(compilerOptions?.paths ?? {}),
    },
    {
      prefix: "<rootDir>/",
    },
  ),
};
