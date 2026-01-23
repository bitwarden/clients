module.exports = {
  displayName: "user-crypto-management",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/libs/user-crypto-management",
};
