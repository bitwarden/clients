import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-bit-dialog-wrapper.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@angular-eslint/template-parser"),
  },
});

ruleTester.run("no-bit-dialog-wrapper", rule.default, {
  valid: [
    {
      name: "bit-dialog at the root of the template",
      code: `<bit-dialog dialogSize="large"></bit-dialog>`,
    },
    {
      name: "bit-simple-dialog at the root of the template",
      code: `<bit-simple-dialog></bit-simple-dialog>`,
    },
    {
      name: "form using bit-dialog as attribute selector",
      code: `<form bit-dialog></form>`,
    },
  ],
  invalid: [
    {
      name: "bit-dialog wrapped in a form",
      code: `<form><bit-dialog></bit-dialog></form>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "bit-simple-dialog wrapped in a form",
      code: `<form><bit-simple-dialog></bit-simple-dialog></form>`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "bit-dialog wrapped in a div",
      code: `<div><bit-dialog></bit-dialog></div>`,
      errors: [{ message: errorMessage }],
    },
  ],
});
