const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.ts");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  // Consuming ESM-only deps under Jest's CJS runtime requires two steps:
  //   1. Widen transformIgnorePatterns so ts-jest transforms these packages'
  //      import/export syntax to CJS at load time.
  //   2. Map Node's `#name` subpath imports (defined in a package's own
  //      package.json `imports` field) to the underlying files, since Jest
  //      does not resolve subpath imports on its own.
  // Long-term: migrate the CLI test runner to Vitest, which handles both
  // natively. Tracked separately.
  transformIgnorePatterns: [
    // Minimum allowlist for chalk v5 and lowdb v7 test paths. jsdom v30's
    // transitive ESM deps (whatwg-url, html-encoding-sniffer, @exodus/bytes,
    // ...) form a broader graph that Path A cannot easily cover; those tests
    // are affected until the CLI test runner moves to Vitest.
    "node_modules/(?!(chalk|lowdb|steno)/)",
  ],
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.spec.json",
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    "^#ansi-styles$": "<rootDir>/../../node_modules/chalk/source/vendor/ansi-styles/index.js",
    "^#supports-color$": "<rootDir>/../../node_modules/chalk/source/vendor/supports-color/index.js",
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
