import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./no-icon-children-in-bit-button.mjs";

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
      name: "should suggest startIcon for <i> with bwi class inside button[bitButton]",
      code: `<button bitButton buttonType="primary"><i class="bwi bwi-plus"></i> Add</button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<button bitButton buttonType="primary" startIcon="bwi-plus">Add</button>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest fix when <i> has droppable spacing classes",
      code: `<button bitButton><i class="bwi bwi-lock tw-me-2" aria-hidden="true"></i> Lock</button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<button bitButton startIcon="bwi-lock">Lock</button>`,
            },
          ],
        },
      ],
    },
    {
      name: "should not suggest fix when <i> has non-droppable classes",
      code: `<button bitButton><i class="bwi bwi-lock tw-text-red" aria-hidden="true"></i> Lock</button>`,
      errors: [{ messageId: "noIconChildren" }],
    },
    {
      name: "should suggest startIcon for <i> with bwi class inside a[bitButton]",
      code: `<a bitButton buttonType="secondary"><i class="bwi bwi-external-link"></i> Link</a>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<a bitButton buttonType="secondary" startIcon="bwi-external-link">Link</a>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest startIcon for <bit-icon> inside button[bitButton]",
      code: `<button bitButton buttonType="primary"><bit-icon name="bwi-lock"></bit-icon> Lock</button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<button bitButton buttonType="primary" startIcon="bwi-lock">Lock</button>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest startIcon for <bit-icon> inside a[bitButton]",
      code: `<a bitButton><bit-icon name="bwi-clone"></bit-icon> Copy</a>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<a bitButton startIcon="bwi-clone">Copy</a>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest startIcon and endIcon for multiple icon children",
      code: `<button bitButton><i class="bwi bwi-plus"></i> Add <i class="bwi bwi-angle-down"></i></button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<button bitButton startIcon="bwi-plus">Add <i class="bwi bwi-angle-down"></i></button>`,
            },
          ],
        },
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useEndIcon",
              output: `<button bitButton endIcon="bwi-angle-down"><i class="bwi bwi-plus"></i> Add</button>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest for both <i> and <bit-icon> children",
      code: `<button bitButton><i class="bwi bwi-plus"></i><bit-icon name="bwi-lock"></bit-icon></button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<button bitButton startIcon="bwi-plus"><bit-icon name="bwi-lock"></bit-icon></button>`,
            },
          ],
        },
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useEndIcon",
              output: `<button bitButton endIcon="bwi-lock"><i class="bwi bwi-plus"></i></button>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest startIcon for <i> with bwi class inside a[bitLink]",
      code: `<a bitLink><i class="bwi bwi-external-link"></i> Link</a>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<a bitLink startIcon="bwi-external-link">Link</a>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest startIcon for <bit-icon> inside button[bitLink]",
      code: `<button bitLink><bit-icon name="bwi-lock"></bit-icon> Lock</button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<button bitLink startIcon="bwi-lock">Lock</button>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest endIcon when icon is after text",
      code: `<button bitButton>Save <i class="bwi bwi-angle-down"></i></button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useEndIcon",
              output: `<button bitButton endIcon="bwi-angle-down">Save</button>`,
            },
          ],
        },
      ],
    },
    {
      name: "should suggest startIcon for <i> with aria-hidden (no extra classes)",
      code: `<button bitButton><i class="bwi bwi-plus" aria-hidden="true"></i> Add</button>`,
      errors: [
        {
          messageId: "noIconChildren",
          suggestions: [
            {
              messageId: "useStartIcon",
              output: `<button bitButton startIcon="bwi-plus">Add</button>`,
            },
          ],
        },
      ],
    },
  ],
});
