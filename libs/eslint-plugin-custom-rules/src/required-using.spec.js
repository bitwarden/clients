/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */

const { RuleTester } = require("@typescript-eslint/rule-tester");

const rule = require("./required-using");

const errorMessage = rule.errorMessage;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      project: [__dirname + "/../tsconfig.spec.json"],
      createDefaultProgram: true,
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

ruleTester.run("required-using", rule, {
  valid: [
    {
      name: "Direct declaration with `using`",
      code: `
        ${setup}
        using client = rc.take();
      `,
    },
    {
      name: "Function reference with `using`",
      code: `
        ${setup}
        const t = rc.take;
        using client = t();
      `,
    },
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
    {
      name: "Assignment without `using`",
      code: `
        ${setup}
        let client;
        client = rc.take();
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Function reference without `using`",
      code: `
        ${setup}
        const t = rc.take;
        const client = t();
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Destructuring without `using`",
      code: `
        ${setup}
        const { value } = rc.take();
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
  ],
});
