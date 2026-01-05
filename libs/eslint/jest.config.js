const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  testEnvironment: "./fix-jsdom.ts",
  testMatch: ["**/+(*.)+(spec).+(mjs)"],
  displayName: "libs/eslint tests",
  setupFilesAfterEnv: ["<rootDir>/test.setup.mjs"],
};
