import path from "node:path";

import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./no-self-package-import.mjs";

// Repo root: libs/eslint/platform -> ../../.. — used so the rule can locate tsconfig.base.json.
const repoRoot = path.resolve(__dirname, "../../..");
const file = (relative) => path.join(repoRoot, relative);

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      sourceType: "module",
      ecmaVersion: 2020,
    },
  },
});

ruleTester.run("no-self-package-import", rule.default, {
  valid: [
    {
      name: "Relative import within the same package",
      filename: file("libs/common/src/foo/bar.ts"),
      code: `import { Baz } from "../baz/qux";`,
    },
    {
      name: "Importing a different package's alias",
      filename: file("libs/common/src/foo/bar.ts"),
      code: `import { Baz } from "@bitwarden/platform";`,
    },
    {
      name: "File outside any known package",
      filename: file("scripts/thing.ts"),
      code: `import { Baz } from "@bitwarden/common/foo";`,
    },
  ],
  invalid: [
    {
      name: "Self-alias import with subpath",
      filename: file("libs/common/src/foo/bar.ts"),
      code: `import { Baz } from "@bitwarden/common/baz/qux";`,
      output: `import { Baz } from "../baz/qux";`,
      errors: [{ messageId: "selfImport" }],
    },
    {
      name: "Self-alias import resolving to a sibling directory",
      filename: file("libs/common/src/foo/bar.ts"),
      code: `import { Thing } from "@bitwarden/common/foo/sibling";`,
      output: `import { Thing } from "./sibling";`,
      errors: [{ messageId: "selfImport" }],
    },
    {
      name: "Self-alias re-export",
      filename: file("libs/common/src/foo/bar.ts"),
      code: `export { Baz } from "@bitwarden/common/baz/qux";`,
      output: `export { Baz } from "../baz/qux";`,
      errors: [{ messageId: "selfImport" }],
    },
    {
      name: "Self-alias import preserves single quotes",
      filename: file("libs/common/src/foo/bar.ts"),
      code: `import { Baz } from '@bitwarden/common/baz/qux';`,
      output: `import { Baz } from '../baz/qux';`,
      errors: [{ messageId: "selfImport" }],
    },
  ],
});
