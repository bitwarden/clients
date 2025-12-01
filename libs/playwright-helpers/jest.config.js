const sharedConfig = require("../shared/jest.config.angular");

module.exports = {
  ...sharedConfig,
  displayName: "playwright-helpers",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/libs/playwright-helpers",
};
