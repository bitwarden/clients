import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-derived-user-api-send.mjs";

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

ruleTester.run("no-derived-user-api-send", rule.default, {
  valid: [
    {
      name: "explicit userId instead of true",
      code: `declare const apiService: any; declare const userId: string; apiService.send("GET", "/x", null, userId, true);`,
    },
    {
      name: "unauthenticated request (authed = false)",
      code: `declare const apiService: any; apiService.send("POST", "/x", null, false, false);`,
    },
    {
      name: "send with fewer than 5 arguments (unrelated method)",
      code: `declare const emitter: any; emitter.send("hello", true);`,
    },
    {
      name: "send with true in body slot but not authed slot",
      code: `declare const apiService: any; declare const userId: string; apiService.send("POST", "/x", true, userId, false);`,
    },
    {
      name: "send with hasResponse not a boolean literal (unrelated .send)",
      code: `declare const other: any; declare const flag: boolean; other.send("a", "b", "c", true, flag);`,
    },
  ],
  invalid: [
    {
      name: "authed with literal true and hasResponse literal",
      code: `declare const apiService: any; apiService.send("GET", "/x", null, true, true);`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "authed with literal true and hasResponse false",
      code: `declare const apiService: any; apiService.send("DELETE", "/x", null, true, false);`,
      errors: [{ message: errorMessage }],
    },
    {
      name: "authed with true via this.send",
      code: `
        class Wrapper {
          declare send: any;
          call() { this.send("GET", "/x", null, true, true); }
        }
      `,
      errors: [{ message: errorMessage }],
    },
    {
      name: "authed with true and extra trailing args",
      code: `declare const apiService: any; apiService.send("GET", "/x", null, true, true, null, () => {});`,
      errors: [{ message: errorMessage }],
    },
  ],
});
