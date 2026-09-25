const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("../../tsconfig.base");
const sharedConfig = require("../../libs/shared/jest.config.angular");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  displayName: "bit-common tests",
  testEnvironment: "jsdom",
  transform: Object.fromEntries(
    Object.entries(sharedConfig.transform).map(([pattern, [transformer, options]]) => [
      pattern,
      [transformer, { ...options, isolatedModules: true }],
    ]),
  ),
  moduleNameMapper: pathsToModuleNameMapper(
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
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$|@angular|rxjs|@bitwarden))"],
  moduleFileExtensions: ["ts", "js", "html", "mjs"],
};
