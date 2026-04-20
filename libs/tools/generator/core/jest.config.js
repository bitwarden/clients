const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../../../tsconfig.base");

/** @type {import('jest').Config} */
module.exports = {
  testMatch: ["**/+(*.)+(spec).+(ts)"],
  preset: "ts-jest",
  testEnvironment: "../../../shared/test.environment.ts",
  setupFiles: ["<rootDir>/../../../shared/polyfill-node-globals.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../../",
  }),
};
