const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "performance-tracking-angular",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths ?? {}, {
    prefix: "<rootDir>/../../",
  }),
  coverageDirectory: "../../coverage/libs/performance-tracking-angular",
};
