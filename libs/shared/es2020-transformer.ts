import * as ts from "typescript";

// Custom Typescript AST transformer for use with ts-jest / jest-preset-angular
// Removes specified ES2020 syntax from source code, as node does not support it yet
// Reference: https://kulshekhar.github.io/ts-jest/docs/getting-started/options/astTransformers
// Use this tool to understand how we identify and filter AST nodes: https://ts-ast-viewer.com/

/**
 * Remember to increase the version whenever transformer's content is changed. This is to inform Jest to not reuse
 * the previous cache which contains old transformer's content
 */
export const version = 1;
export const name = "bit-es2020-transformer";

// Returns true for 'import.meta' statements
const isImportMetaStatement = (node: ts.Node) =>
  ts.isPropertyAccessExpression(node) &&
  ts.isMetaProperty(node.expression) &&
  node.expression.keywordToken === ts.SyntaxKind.ImportKeyword;

export const factory = function (/*opts?: Opts*/) {
  function visitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<any> => {
      if (isImportMetaStatement(node)) {
        return null;
      }

      // Continue searching child nodes
      return ts.visitEachChild(node, visitor, ctx);
    };
    return visitor;
  }
  return (ctx: ts.TransformationContext): ts.Transformer<any> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, sf));
  };
};
