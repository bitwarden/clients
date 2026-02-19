import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-bwi-class-usage.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@angular-eslint/template-parser"),
  },
});

ruleTester.run("no-bwi-class-usage", rule.default, {
  valid: [
    {
      name: "should allow bit-icon component usage",
      code: `<bit-icon icon="bwi-lock"></bit-icon>`,
    },
    {
      name: "should allow bit-icon with bwi-fw helper class",
      code: `<bit-icon icon="bwi-lock" class="bwi-fw"></bit-icon>`,
    },
    {
      name: "should allow bit-icon with name attribute and bwi-fw helper class",
      code: `<bit-icon name="bwi-angle-down" class="bwi-fw"/>`,
    },
    {
      name: "should allow elements without bwi classes",
      code: `<div class="tw-flex tw-p-4"></div>`,
    },
    {
      name: "should allow bwi-fw helper class alone",
      code: `<i class="bwi-fw"></i>`,
    },
    {
      name: "should allow bwi-sm helper class",
      code: `<i class="bwi-sm"></i>`,
    },
    {
      name: "should allow multiple helper classes together",
      code: `<i class="bwi-fw bwi-sm"></i>`,
    },
    {
      name: "should allow helper classes with other non-bwi classes",
      code: `<i class="tw-flex bwi-fw bwi-lg tw-p-2"></i>`,
    },
    {
      name: "should allow bwi-spin helper class",
      code: `<i class="bwi-spin"></i>`,
    },
    {
      name: "should allow bwi-rotate-270 helper class",
      code: `<i class="bwi-rotate-270"></i>`,
    },
  ],
  invalid: [
    {
      name: "should error on direct bwi class usage",
      code: `<i class="bwi bwi-lock"></i>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should error on bwi class with other classes",
      code: `<i class="tw-flex bwi bwi-lock tw-p-2"></i>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should error on single bwi-* icon class",
      code: `<i class="bwi-lock"></i>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should error on icon classes even with helper classes",
      code: `<i class="bwi bwi-lock bwi-fw"></i>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should error on base bwi class alone",
      code: `<i class="bwi"></i>`,
      errors: [{ message: errorMessage }],
    },
  ],
});
