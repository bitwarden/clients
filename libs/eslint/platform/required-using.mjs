import { ESLintUtils } from "@typescript-eslint/utils";

export const errorMessage = "'using' keyword is required but not used";

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Ensure objects implementing UsingRequired are used with the using keyword",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
  },
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    // Function to check if a type implements the `UsingRequired` interface
    function implementsUsingRequired(type) {
      const symbol = type.getSymbol();
      if (!symbol) {
        return false;
      }

      const declarations = symbol.getDeclarations() || [];
      for (const declaration of declarations) {
        const heritageClauses = declaration.heritageClauses || [];
        for (const clause of heritageClauses) {
          if (
            clause.types.some(
              (typeExpression) =>
                checker.typeToString(checker.getTypeAtLocation(typeExpression.expression)) ===
                "UsingRequired",
            )
          ) {
            return true;
          }
        }
      }

      return false;
    }

    // Function to check if a function call returns a `UsingRequired`
    function returnsUsingRequired(node) {
      if (node.type === "CallExpression") {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const returnType = checker.getTypeAtLocation(tsNode);

        return implementsUsingRequired(returnType);
      }

      return false;
    }

    return {
      VariableDeclarator(node) {
        // Skip if `using` or `await using` is already present
        if (
          node.parent.type === "VariableDeclaration" &&
          (node.parent.kind === "using" ||
            node.parent.kind === "await using" ||
            // Some parsers represent `await using` as kind: 'using' with an `await: true` flag
            node.parent.await === true)
        ) {
          return;
        }

        // Check if the initializer returns a `UsingRequired`
        if (node.init && returnsUsingRequired(node.init)) {
          context.report({
            node,
            message: errorMessage,
          });
        }
      },
      AssignmentExpression(node) {
        // Check if the right-hand side returns a `UsingRequired`
        if (returnsUsingRequired(node.right)) {
          context.report({
            node,
            message: errorMessage,
          });
        }
      },
    };
  },
};
