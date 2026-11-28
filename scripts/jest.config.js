module.exports = {
  displayName: "scripts",
  preset: "../jest.preset.js",
  testEnvironment: "node",
  testMatch: ["<rootDir>/*.spec.ts"],
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js"],
  coverageDirectory: "../coverage/scripts",
};
