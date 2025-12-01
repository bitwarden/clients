const { pathsToModuleNameMapper } = require("ts-jest");
const sharedConfig = require("../../../../shared/jest.config");

const { compilerOptions } = require("../../../../../tsconfig.base");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/../../../../../libs/shared/polyfill-node-globals.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    { "@bitwarden/common/spec": ["libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/../../../../../",
    },
  ),
};
