import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-icon-children-in-bit-button.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@angular-eslint/template-parser"),
  },
});

ruleTester.run("no-icon-children-in-bit-button", rule.default, {
  valid: [
    {
      name: "should allow bitButton with startIcon input",
      code: `<button bitButton startIcon="bwi-plus">Add</button>`,
    },
    {
      name: "should allow bitButton with endIcon input",
      code: `<button bitButton endIcon="bwi-external-link">Open</button>`,
    },
    {
      name: "should allow a[bitButton] with startIcon input",
      code: `<a bitButton startIcon="bwi-external-link" href="https://example.com">Link</a>`,
    },
    {
      name: "should allow <i> with bwi inside a regular button (no bitButton)",
      code: `<button type="button"><i class="bwi bwi-lock"></i> Lock</button>`,
    },
    {
      name: "should allow <bit-icon> inside a regular div",
      code: `<div><bit-icon name="bwi-lock"></bit-icon></div>`,
    },
    {
      name: "should allow bitButton with only text content",
      code: `<button bitButton buttonType="primary">Save</button>`,
    },
    {
      name: "should allow <i> without bwi class inside bitButton",
      code: `<button bitButton><i class="fa fa-lock"></i> Lock</button>`,
    },
    {
      name: "should allow bitLink with startIcon input",
      code: `<a bitLink startIcon="bwi-external-link" href="https://example.com">Link</a>`,
    },
    {
      name: "should allow bitLink with only text content",
      code: `<a bitLink href="https://example.com">Link</a>`,
    },
  ],
  invalid: [
    {
      name: "should warn on <i> with bwi class inside button[bitButton]",
      code: `<button bitButton buttonType="primary"><i class="bwi bwi-plus"></i> Add</button>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should warn on <i> with bwi class and extra classes inside button[bitButton]",
      code: `<button bitButton><i class="bwi bwi-lock tw-me-2" aria-hidden="true"></i> Lock</button>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should warn on <i> with bwi class inside a[bitButton]",
      code: `<a bitButton buttonType="secondary"><i class="bwi bwi-external-link"></i> Link</a>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should warn on <bit-icon> inside button[bitButton]",
      code: `<button bitButton buttonType="primary"><bit-icon name="bwi-lock"></bit-icon> Lock</button>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should warn on <bit-icon> inside a[bitButton]",
      code: `<a bitButton><bit-icon name="bwi-clone"></bit-icon> Copy</a>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should warn on multiple icon children inside bitButton",
      code: `<button bitButton><i class="bwi bwi-plus"></i> Add <i class="bwi bwi-angle-down"></i></button>`,
      errors: [{ message: errorMessage }, { message: errorMessage }],
    },
    {
      name: "should warn on both <i> and <bit-icon> children",
      code: `<button bitButton><i class="bwi bwi-plus"></i><bit-icon name="bwi-lock"></bit-icon></button>`,
      errors: [{ message: errorMessage }, { message: errorMessage }],
    },
    {
      name: "should warn on <i> with bwi class inside a[bitLink]",
      code: `<a bitLink><i class="bwi bwi-external-link"></i> Link</a>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "should warn on <bit-icon> inside button[bitLink]",
      code: `<button bitLink><bit-icon name="bwi-lock"></bit-icon> Lock</button>`,
      errors: [{ message: errorMessage }],
    },
  ],
});
