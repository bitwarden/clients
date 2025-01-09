/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
const { defaultTransformerOptions } = require("jest-preset-angular/presets");

/** @type {import('jest').Config} */
module.exports = {
  testMatch: ["**/+(*.)+(spec).+(ts)"],

  testPathIgnorePatterns: [
    "/node_modules/", // default value
    ".*.type.spec.ts", // ignore type tests (which are checked at compile time and not run by jest)
  ],

  // Improves on-demand performance, for watches prefer 25%, overridable by setting --maxWorkers
  maxWorkers: "50%",

  transform: {
    "^.+\\.(ts|js|mjs|svg)$": [
      "jest-preset-angular",
      {
        ...defaultTransformerOptions,
        // Jest does not use tsconfig.spec.json by default
        tsconfig: "<rootDir>/tsconfig.spec.json",
        // Further workaround for memory leak, recommended here:
        // https://github.com/kulshekhar/ts-jest/issues/1967#issuecomment-697494014
        // Makes tests run faster and reduces size/rate of leak, but loses typechecking on test code
        // See https://bitwarden.atlassian.net/browse/EC-497 for more info
        isolatedModules: true,
        astTransformers: {
          before: ["<rootDir>/../../libs/shared/es2020-transformer.ts"],
        },
      },
    ],
  },
};
