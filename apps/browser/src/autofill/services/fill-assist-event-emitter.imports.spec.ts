import * as fs from "fs";
import * as path from "path";

import * as ts from "typescript";

/**
 * Companion guard for the content-script bundle-size budget. The emitter and
 * the rule qualification service both run in the content script. Pulling
 * `@angular` or `@bitwarden/sdk-internal` into either file balloons the
 * content-script bundle. Type-only imports (`import type { ... } from ...`)
 * are elided at compile time and do not contribute to the bundle, so they
 * are allowed.
 */
describe("content-script bundle-size guard", () => {
  const forbiddenPrefixes = ["@angular", "@bitwarden/sdk-internal"];

  // Covers both the concrete emitter and its abstraction so a future edit to
  // either side of the interface split cannot silently pull a forbidden
  // runtime dependency into the content-script bundle.
  describe.each([
    ["fill-assist-event-emitter.ts", "fill-assist-event-emitter.ts"],
    ["abstractions/fill-assist-event-emitter.ts", "abstractions/fill-assist-event-emitter.ts"],
    ["rule-qualification.service.ts", "rule-qualification.service.ts"],
  ])("%s", (_label, fileName) => {
    const filePath = path.resolve(__dirname, fileName);
    const source = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
    );

    const runtimeImportSpecifiers = collectRuntimeImportSpecifiers(sourceFile);

    for (const prefix of forbiddenPrefixes) {
      it(`has no runtime imports of ${prefix}`, () => {
        const violating = runtimeImportSpecifiers.filter((specifier) =>
          specifier.startsWith(prefix),
        );
        expect(violating).toEqual([]);
      });
    }
  });
});

/**
 * Returns the module specifier of every import that contributes to the
 * runtime bundle. Whole-import type-only imports (`import type { ... } from`)
 * are omitted. Imports with any value specifier — even if some named
 * specifiers are marked `type` — are included, because the module itself is
 * still loaded at runtime.
 */
function collectRuntimeImportSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];

  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node)) {
      return;
    }
    // Whole-import type-only: `import type { X } from "..."` or
    // `import type X from "..."`. These are compiler-stripped.
    if (node.importClause?.isTypeOnly) {
      return;
    }
    // Side-effect-only (`import "..."`) and value imports both contribute.
    if (ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
  });

  return specifiers;
}
