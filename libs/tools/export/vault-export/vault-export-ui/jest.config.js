const { pathsToModuleNameMapper } = require("ts-jest");
const sharedConfig = require("../../../../shared/jest.config");

const { compilerOptions } = require("../../../../../tsconfig.base");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../../../",
  }),
};
