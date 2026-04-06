const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "libs/components tests",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../",
  }),
};
