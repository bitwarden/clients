const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../../../shared/tsconfig.spec");

/** @type {import('jest').Config} */
module.exports = {
  testMatch: ["**/+(*.)+(spec).+(ts)"],
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../",
  }),
};
