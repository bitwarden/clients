const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../../tsconfig.base");

const sharedConfig = require("../../shared/jest.config.angular");

// The Angular preset expects this config file to be exactly two levels
// below the `libs` directory. We need a custom config to override this
const { createCjsPreset } = require("jest-preset-angular/presets");
const presetConfig = createCjsPreset({
  astTransformers: {
    before: ["<rootDir>/../../../libs/shared/es2020-transformer.ts"],
  },
});

/** @type {import('jest').Config} */
const config = {
  ...sharedConfig,
  ...presetConfig,
  displayName: "tools/share tests",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  // oauth4webapi is ESM-only; allow jest-preset-angular's transformer to compile it.
  transformIgnorePatterns: [
    "node_modules/(?!(.*\\.mjs$|@angular/common/locales/.*\\.js$|oauth4webapi/.*))",
  ],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../",
  }),
};
module.exports = config;
