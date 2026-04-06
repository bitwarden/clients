import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-enums.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*"],
      },
      tsconfigRootDir: __dirname + "/..",
    },
  },
});

ruleTester.run("no-enums", rule.default, {
  valid: [
    {
      name: "Using const instead of enum",
      code: `
        const Status = {
          Active: "active",
          Inactive: "inactive",
        } as const;
      `,
    },
    {
      name: "Using const with type",
      code: `
        const Status = {
          Active: "active",
          Inactive: "inactive",
        } as const;
        type Status = typeof Status[keyof typeof Status];
      `,
    },
  ],
  invalid: [
    {
      name: "Using enum declaration",
      code: `
        enum Status {
          Active = "active",
          Inactive = "inactive",
        }
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Using enum with numeric values",
      code: `
        enum Direction {
          Up = 1,
          Down = 2,
          Left = 3,
          Right = 4,
        }
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
  ],
});
