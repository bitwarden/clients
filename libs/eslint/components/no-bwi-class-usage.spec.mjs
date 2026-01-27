import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-bwi-class-usage.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@angular-eslint/template-parser"),
  },
});

ruleTester.run("no-bwi-class-usage", rule.default, {
  valid: [],
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
      name: "should error on single bwi-* class",
      code: `<i class="bwi-lock"></i>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should error on bwi-fw modifier",
      code: `<i class="bwi bwi-lock bwi-fw"></i>`,
      errors: [{ message: errorMessage }],
    },
  ],
});
