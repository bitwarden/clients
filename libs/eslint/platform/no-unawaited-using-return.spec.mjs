import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-unawaited-using-return.mjs";

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

const decl = `declare function take(): { value: { foo(): Promise<string>; name: string } };`;

ruleTester.run("no-unawaited-using-return", rule.default, {
  valid: [
    {
      name: "Awaited return inside using scope",
      code: `
${decl}
async function f() {
  using ref = take();
  return await ref.value.foo();
}
`,
    },
    {
      name: "Returning a non-Promise value from a using scope",
      code: `
${decl}
function f(): string {
  using ref = take();
  return ref.value.name;
}
`,
    },
    {
      name: "Promise return with no using in scope",
      code: `
${decl}
function f() {
  return take().value.foo();
}
`,
    },
    {
      name: "Side effect with no return",
      code: `
${decl}
async function f() {
  using ref = take();
  await ref.value.foo();
}
`,
    },
  ],
  invalid: [
    {
      name: "Sync arrow returns unawaited Promise built from using resource",
      code: `
${decl}
const cb = (x: number) => {
  using ref = take();
  return ref.value.foo();
};
`,
      output: `
${decl}
const cb = async (x: number) => {
  using ref = take();
  return await ref.value.foo();
};
`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "Aliased Promise returned without await",
      code: `
${decl}
function f() {
  using ref = take();
  const p = ref.value.foo();
  return p;
}
`,
      output: `
${decl}
async function f() {
  using ref = take();
  const p = ref.value.foo();
  return await p;
}
`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "Async function returns unawaited Promise from using scope",
      code: `
${decl}
async function g() {
  using ref = take();
  return ref.value.foo();
}
`,
      output: `
${decl}
async function g() {
  using ref = take();
  return await ref.value.foo();
}
`,
      errors: [{ message: errorMessage }],
    },
  ],
});
