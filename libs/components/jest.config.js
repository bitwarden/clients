const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "libs/components tests",
  // Include the repo-root .storybook dir so specs for shared Storybook helpers run.
  roots: ["<rootDir>", "<rootDir>/../../.storybook"],
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../",
  }),
};
