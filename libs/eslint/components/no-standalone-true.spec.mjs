import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-standalone-true.mjs";

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

ruleTester.run("no-standalone-true", rule.default, {
  valid: [
    {
      name: "@Component without standalone property",
      code: `
        @Component({
          selector: "app-foo",
          templateUrl: "./foo.component.html",
        })
        class FooComponent {}
      `,
    },
    {
      name: "@Directive without standalone property",
      code: `
        @Directive({
          selector: "[appFoo]",
        })
        class FooDirective {}
      `,
    },
    {
      name: "@Pipe without standalone property",
      code: `
        @Pipe({
          name: "foo",
        })
        class FooPipe {}
      `,
    },
    {
      name: "@Component with standalone: false",
      code: `
        @Component({
          selector: "app-foo",
          standalone: false,
          templateUrl: "./foo.component.html",
        })
        class FooComponent {}
      `,
    },
    {
      name: "standalone: true in a plain object (not a decorator)",
      code: `
        const config = {
          standalone: true,
          name: "test",
        };
      `,
    },
    {
      name: "@Injectable with standalone: true (not a target decorator)",
      code: `
        @Injectable({
          providedIn: "root",
          standalone: true,
        })
        class FooService {}
      `,
    },
    {
      name: "@Component with empty object",
      code: `
        @Component({})
        class FooComponent {}
      `,
    },
  ],

  invalid: [
    {
      name: "@Component with standalone: true (middle property)",
      code: `
        @Component({
          selector: "app-foo",
          standalone: true,
          templateUrl: "./foo.component.html",
        })
        class FooComponent {}
      `,
      output: `
        @Component({
          selector: "app-foo",
          templateUrl: "./foo.component.html",
        })
        class FooComponent {}
      `,
      errors: [{ message: errorMessage }],
    },
    {
      name: "@Component with standalone: true (first property)",
      code: `
        @Component({
          standalone: true,
          selector: "app-foo",
        })
        class FooComponent {}
      `,
      output: `
        @Component({
          selector: "app-foo",
        })
        class FooComponent {}
      `,
      errors: [{ message: errorMessage }],
    },
    {
      name: "@Component with standalone: true (last property)",
      code: `
        @Component({
          selector: "app-foo",
          standalone: true,
        })
        class FooComponent {}
      `,
      output: `
        @Component({
          selector: "app-foo",
        })
        class FooComponent {}
      `,
      errors: [{ message: errorMessage }],
    },
    {
      name: "@Component with standalone: true (sole property)",
      code: `
        @Component({
          standalone: true,
        })
        class FooComponent {}
      `,
      output: `
        @Component({})
        class FooComponent {}
      `,
      errors: [{ message: errorMessage }],
    },
    {
      name: "@Directive with standalone: true",
      code: `
        @Directive({
          selector: "[appFoo]",
          standalone: true,
        })
        class FooDirective {}
      `,
      output: `
        @Directive({
          selector: "[appFoo]",
        })
        class FooDirective {}
      `,
      errors: [{ message: errorMessage }],
    },
    {
      name: "@Pipe with standalone: true",
      code: `
        @Pipe({
          name: "foo",
          standalone: true,
        })
        class FooPipe {}
      `,
      output: `
        @Pipe({
          name: "foo",
        })
        class FooPipe {}
      `,
      errors: [{ message: errorMessage }],
    },
    {
      name: "@Component with standalone: true on single line",
      code: `@Component({ standalone: true, selector: "app-foo" }) class FooComponent {}`,
      output: `@Component({ selector: "app-foo" }) class FooComponent {}`,
      errors: [{ message: errorMessage }],
    },
  ],
});
