const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.ts");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  transform: {
    ...sharedConfig.transform,
    "^.+\\.js$": [
      "babel-jest",
      { presets: [["@babel/preset-env", { targets: { node: "current" } }]] },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(https-proxy-agent|agent-base|proxy-agent-negotiate)/)",
  ],
  moduleNameMapper: {
    "@bitwarden/common/platform/services/sdk/default-sdk-client-factory":
      "<rootDir>/../../libs/common/spec/jest-sdk-client-factory",
    ...pathsToModuleNameMapper(
      {
        "@bitwarden/common/spec": ["libs/common/spec"],
        ...(compilerOptions?.paths || {}),
      },
      {
        prefix: "<rootDir>/../../",
      },
    ),
  },
};
