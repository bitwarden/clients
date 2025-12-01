const { pathsToModuleNameMapper } = require("ts-jest");
const sharedConfig = require("../../../../shared/jest.config");

const { compilerOptions } = require("../../../../../tsconfig.base");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "ts-jest",
  testEnvironment: "../../../../shared/test.environment.ts",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../../../",
  }),
};
