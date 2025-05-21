const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  testMatch: ["**/+(*.)+(spec).+(mjs)"],
  displayName: "libs/eslint tests",
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/test.setup.mjs"],
};
