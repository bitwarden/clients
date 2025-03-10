const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../../shared/tsconfig.spec");

/** @type {import('jest').Config} */
module.exports = {
  testMatch: ["**/+(*.)+(spec).+(ts)"],
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../",
  }),
};
