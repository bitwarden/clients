const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../../tsconfig.base");

const { createCjsPreset } = require("jest-preset-angular/presets");

// FIXME: Should use the shared config!
const presetConfig = createCjsPreset({
  tsconfig: "<rootDir>/tsconfig.spec.json",
  astTransformers: {
    before: ["<rootDir>/../../shared/es2020-transformer.ts"],
  },
  diagnostics: {
    ignoreCodes: ["TS151001"],
  },
});

/** @type {import('jest').Config} */
module.exports = {
  ...presetConfig,
  displayName: "tools-share",
  // Reached through @bitwarden/send-ui: oauth4webapi is ESM-only, so let
  // jest-preset-angular's transformer compile it rather than skipping node_modules.
  transformIgnorePatterns: [
    "node_modules/(?!(.*\\.mjs$|@angular/common/locales/.*\\.js$|oauth4webapi/.*))",
  ],
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  coverageDirectory: "../../../coverage/libs/tools/share",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../",
  }),
};
