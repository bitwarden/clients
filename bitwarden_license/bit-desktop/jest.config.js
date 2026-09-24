const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "bit-desktop",
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/../../apps/desktop/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    { "@bitwarden/common/spec": ["libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/../../",
    },
  ),
  testMatch: ["**/+(*.)+(spec).+(ts)"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts", "!src/**/index.ts"],
  coverageDirectory: "<rootDir>/../../coverage/bitwarden_license/bit-desktop",
};
