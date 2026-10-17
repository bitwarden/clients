const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  transform: {
    ...sharedConfig.transform,
    // Build scripts are .mts so Node runs them directly; the preset's transform only matches
    // .ts, so reuse its transformer for them.
    "^.+\\.mts$": sharedConfig.transform["^.+\\.(ts|js|mjs|html|svg)$"],
  },
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    { "@bitwarden/common/spec": ["libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/../../",
    },
  ),
};
