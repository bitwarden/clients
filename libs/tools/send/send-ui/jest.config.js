const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../../../tsconfig.base");

const { createCjsPreset } = require("jest-preset-angular/presets");

// FIXME: Should use the shared config!
const presetConfig = createCjsPreset({
  tsconfig: "<rootDir>/tsconfig.spec.json",
  astTransformers: {
    before: ["<rootDir>/../../../shared/es2020-transformer.ts"],
  },
  diagnostics: {
    ignoreCodes: ["TS151001"],
  },
});

/** @type {import('jest').Config} */
module.exports = {
  ...presetConfig,
  displayName: "tools/send-ui tests",
  // oauth4webapi is ESM-only; allow jest-preset-angular's transformer to compile it.
  transformIgnorePatterns: [
    "node_modules/(?!(.*\\.mjs$|@angular/common/locales/.*\\.js$|oauth4webapi/.*))",
  ],
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../../",
  }),
};
