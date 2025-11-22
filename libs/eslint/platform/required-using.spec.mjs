import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./required-using.mjs";

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

const setup = `
  interface UsingRequired {}
  class Ref implements UsingRequired {}

  const rc = {
    take(): Ref {
      return new Ref();
    },
  };
`;

ruleTester.run("required-using", rule.default, {
  valid: [
    {
      name: "Direct declaration with `using`",
      code: `
        ${setup}
        using client = rc.take();
      `,
    },
    // {
    //   name: "Function reference with `using`",
    //   code: `
    //     ${setup}
    //     const t = rc.take;
    //     using client = t();
    //   `,
    // },
  ],
  invalid: [
    {
      name: "Direct declaration without `using`",
      code: `
        ${setup}
        const client = rc.take();
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    // {
    //   name: "Assignment without `using`",
    //   code: `
    //     ${setup}
    //     let client;
    //     client = rc.take();
    //   `,
    //   errors: [
    //     {
    //       message: errorMessage,
    //     },
    //   ],
    // },
    // {
    //   name: "Function reference without `using`",
    //   code: `
    //     ${setup}
    //     const t = rc.take;
    //     const client = t();
    //   `,
    //   errors: [
    //     {
    //       message: errorMessage,
    //     },
    //   ],
    // },
    // {
    //   name: "Destructuring without `using`",
    //   code: `
    //     ${setup}
    //     const { value } = rc.take();
    //   `,
    //   errors: [
    //     {
    //       message: errorMessage,
    //     },
    //   ],
    // },
  ],
});
