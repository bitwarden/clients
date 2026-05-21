// @ts-check
/**
 * Tests for the channel-manifest extractor.
 *
 * The extractor isn't exported; this spec re-implements its core behavior by
 * invoking the same `typescript` AST walk on synthetic source strings. It
 * verifies that real handle declarations would be picked up correctly — the
 * production script can then be a thin wrapper around the same logic.
 *
 * Run with: node --experimental-vm-modules apps/browser/scripts/build-channel-manifest.spec.mjs
 *
 * Exits 0 on pass, non-zero on first failure.
 */

import ts from "typescript";

const FACTORY_NAMES = new Set([
  "defineNotice",
  "defineRequest",
  "defineContentNotice",
  "defineContentRequest",
]);

/**
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} key
 */
function readStringProp(obj, key) {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (!ts.isIdentifier(prop.name) || prop.name.text !== key) continue;
    if (ts.isStringLiteralLike(prop.initializer)) return prop.initializer.text;
  }
  return undefined;
}

/**
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} key
 */
function readIdentifierProp(obj, key) {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (!ts.isIdentifier(prop.name) || prop.name.text !== key) continue;
    if (ts.isIdentifier(prop.initializer)) return prop.initializer.text;
  }
  return undefined;
}

function extract(source) {
  const sf = ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const factory = node.expression.text;
      if (FACTORY_NAMES.has(factory) && node.arguments.length > 0) {
        const arg = node.arguments[0];
        if (ts.isObjectLiteralExpression(arg)) {
          found.push({
            factory,
            command: readStringProp(arg, "command"),
            envPair: readStringProp(arg, "envPair"),
            schema: readIdentifierProp(arg, "schema"),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return found;
}

let failed = 0;
function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failed++;
    process.stderr.write(
      `  ✕ ${label}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}\n`,
    );
  }
}

process.stdout.write("build-channel-manifest extractor\n");

expect(
  "picks up a defineNotice with all fields",
  extract(`
    import { defineNotice } from "./browser-api.middleware";
    import { MySchema } from "../security/schemas/x";
    export const handle = defineNotice({
      command: "myCommand",
      envPair: "popup:background",
      schema: MySchema,
    });
  `),
  [
    {
      factory: "defineNotice",
      command: "myCommand",
      envPair: "popup:background",
      schema: "MySchema",
    },
  ],
);

expect(
  "picks up a defineRequest",
  extract(`
    const h = defineRequest({ command: "ask", envPair: "content:background" });
  `),
  [{ factory: "defineRequest", command: "ask", envPair: "content:background", schema: undefined }],
);

expect(
  "picks up defineContentNotice and defineContentRequest",
  extract(`
    const a = defineContentNotice({ command: "n", envPair: "content:background" });
    const b = defineContentRequest({ command: "r", envPair: "content:background" });
  `),
  [
    {
      factory: "defineContentNotice",
      command: "n",
      envPair: "content:background",
      schema: undefined,
    },
    {
      factory: "defineContentRequest",
      command: "r",
      envPair: "content:background",
      schema: undefined,
    },
  ],
);

expect(
  "ignores unrelated calls",
  extract(`
    const x = someOtherFn({ command: "x", envPair: "popup:background" });
    const y = defineThingy({ command: "y" });
  `),
  [],
);

expect(
  "returns undefined for missing command/envPair (caught at review, not silently filled)",
  extract(`
    const x = defineNotice({ schema: Foo });
  `),
  [{ factory: "defineNotice", command: undefined, envPair: undefined, schema: "Foo" }],
);

if (failed > 0) {
  process.stderr.write(`\n${failed} test(s) failed.\n`);
  process.exit(1);
}
process.stdout.write("\nAll passed.\n");
