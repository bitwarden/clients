const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../shared/jest.config.ts");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "libs/legacy-crypto tests",
  preset: "ts-jest",
  // The web crypto implementation needs `window.crypto`, which test.setup.ts polyfills.
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../",
  }),
  coverageDirectory: "../../coverage/libs/legacy-crypto",
};
