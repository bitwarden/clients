const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  setupFilesAfterEnv: ["../../apps/web/test.setup.ts"],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(
      {
        "@bitwarden/common/spec": ["libs/common/spec"],
        "@bitwarden/common": ["libs/common/src/*"],
        "@bitwarden/admin-console/common": ["libs/admin-console/src/common"],
        ...(compilerOptions?.paths ?? {}),
      },
      {
        prefix: "<rootDir>/../../",
      },
    ),
    // Mirrors webpack.config.js's resolve.alias: bit-* clients replace @bitwarden/sdk-internal
    // with the commercial SDK build, so its runtime (non-type) exports — e.g. PAM's
    // `isLeasingError` — resolve under jest the same way they do in the real bundle. Type-only
    // imports from @bitwarden/sdk-internal are unaffected (erased at compile time either way).
    "^@bitwarden/sdk-internal$": "@bitwarden/commercial-sdk-internal",
  },
};
