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
      code: `<bit-icon icon="bwi-lock" />`,
    },
    {
      name: "should allow bit-icon with bwi-fw helper class",
      code: `<bit-icon icon="bwi-lock" class="bwi-fw" />`,
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
      name: "should suggest replacing direct bwi class usage with bit-icon",
      code: `<i class="bwi bwi-lock"></i>`,
      errors: [
        {
          message: errorMessage,
          suggestions: [{ messageId: "replaceBwi", output: `<bit-icon name="bwi-lock" />` }],
        },
      ],
    },
    {
      name: "should suggest fix preserving non-bwi classes",
      code: `<i class="tw-flex bwi bwi-lock tw-p-2"></i>`,
      errors: [
        {
          message: errorMessage,
          suggestions: [
            {
              messageId: "replaceBwi",
              output: `<bit-icon name="bwi-lock" class="tw-flex tw-p-2" />`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest fix for single bwi-* icon class without base bwi",
      code: `<i class="bwi-lock"></i>`,
      errors: [
        {
          message: errorMessage,
          suggestions: [{ messageId: "replaceBwi", output: `<bit-icon name="bwi-lock" />` }],
        },
      ],
    },
    {
      name: "should suggest fix converting bwi-fw to fixedWidth attribute",
      code: `<i class="bwi bwi-lock bwi-fw"></i>`,
      errors: [
        {
          message: errorMessage,
          suggestions: [
            {
              messageId: "replaceBwi",
              output: `<bit-icon name="bwi-lock" fixedWidth />`,
            },
          ],
        },
      ],
    },
    {
      name: "should not suggest fix for base bwi class alone (no icon name)",
      code: `<i class="bwi"></i>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should suggest fix dropping aria-hidden='true'",
      code: `<i class="bwi bwi-lock" aria-hidden="true"></i>`,
      errors: [
        {
          message: errorMessage,
          suggestions: [{ messageId: "replaceBwi", output: `<bit-icon name="bwi-lock" />` }],
        },
      ],
    },
    {
      name: "should suggest fix preserving other attributes and dropping aria-hidden",
      code: `<i slot="end" class="bwi bwi-external-link" aria-hidden="true"></i>`,
      errors: [
        {
          message: errorMessage,
          suggestions: [
            {
              messageId: "replaceBwi",
              output: `<bit-icon name="bwi-external-link" slot="end" />`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest fix with fixedWidth and preserve tw utility classes",
      code: `<i class="bwi bwi-plus bwi-fw tw-me-2" aria-hidden="true"></i>`,
      errors: [
        {
          message: errorMessage,
          suggestions: [
            {
              messageId: "replaceBwi",
              output: `<bit-icon name="bwi-plus" fixedWidth class="tw-me-2" />`,
            },
          ],
        },
      ],
    },
    {
      name: "should not suggest fix for non-i elements (div)",
      code: `<div class="bwi bwi-lock"></div>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should not suggest fix for non-i elements (span)",
      code: `<span class="bwi bwi-lock"></span>`,
      errors: [{ message: errorMessage }],
    },
  ],
});
