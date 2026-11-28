const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../../tsconfig.base");

const sharedConfig = require("../../libs/shared/jest.config.angular");

const { getAutofillLoginLabels } = require("./config/autofill-login-labels.mjs");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  globals: {
    ...sharedConfig.globals,
    AUTOFILL_LOGIN_FIELD_LABELS: getAutofillLoginLabels(),
  },
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(
    { "@bitwarden/common/spec": ["libs/common/spec"], ...(compilerOptions?.paths ?? {}) },
    {
      prefix: "<rootDir>/../../",
    },
  ),
};
