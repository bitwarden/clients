const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "bit-pam tests",
  coverageDirectory: "../../coverage/bitwarden_license/bit-pam",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(
      // lets us use @bitwarden/common/spec in tests
      { "@bitwarden/common/spec": ["libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
      {
        prefix: "<rootDir>/../../",
      },
    ),
    // bit-* code resolves `@bitwarden/sdk-internal` to the commercial wasm build
    // (see `bitwarden_license/bit-common/src/platform/sdk/sdk-alias.d.ts` for the
    // type-level alias; webpack does the same via `resolve.alias` in the real build).
    "^@bitwarden/sdk-internal$": "<rootDir>/../../node_modules/@bitwarden/commercial-sdk-internal",
  },
};
