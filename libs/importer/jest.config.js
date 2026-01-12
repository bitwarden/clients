const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../shared/jest.config.ts");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  testEnvironment: "jsdom",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../",
  }),
};
