const { pathsToModuleNameMapper } = require("ts-jest");
const sharedConfig = require("../../../shared/jest.config.angular");

const { compilerOptions } = require("../../../../tsconfig.base");

const { createCjsPreset } = require("jest-preset-angular/presets");

// FIXME: Should use the shared config!
const presetConfig = createCjsPreset({
  tsconfig: "<rootDir>/tsconfig.spec.json",
  diagnostics: {
    ignoreCodes: ["TS151001"],
  },
});

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  ...presetConfig,
  displayName: "tools/send-ui tests",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/../../../../",
  }),
};
