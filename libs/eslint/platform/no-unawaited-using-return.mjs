import { ESLintUtils } from "@typescript-eslint/utils";

export const errorMessage =
  "Returning an unawaited Promise from a scope with a `using` declaration disposes the resource before the Promise settles. Await the value before returning.";

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

const USING_KINDS = new Set(["using", "await using"]);

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow returning an unawaited Promise from a scope that holds a `using` resource",
      category: "Possible Errors",
      recommended: false,
    },
    fixable: "code",
    schema: [],
  },
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    function isThenable(node) {
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) {
        return false;
      }

      const type = checker.getTypeAtLocation(tsNode);
      const constituents = type.isUnion() ? type.types : [type];

      return constituents.some((constituent) => {
        const thenSymbol = constituent.getProperty("then");
        if (!thenSymbol) {
          return false;
        }

        const thenType = checker.getTypeOfSymbolAtLocation(thenSymbol, tsNode);
        return thenType.getCallSignatures().length > 0;
      });
    }

    function nearestFunction(node) {
      let current = node.parent;
      while (current) {
        if (FUNCTION_TYPES.has(current.type)) {
          return current;
        }
        current = current.parent;
      }
      return null;
    }

    // Walks up from the return to the enclosing function, looking for a `using`/`await using`
    // declaration in any enclosing block that appears lexically before the return. Such a
    // resource is live at the return and will be disposed when the return exits its block.
    function hasLiveUsingInScope(returnNode, fn) {
      let child = returnNode;
      let parent = returnNode.parent;

      while (parent) {
        let body = null;
        if (parent.type === "BlockStatement" || parent.type === "StaticBlock") {
          body = parent.body;
        } else if (parent.type === "SwitchCase") {
          body = parent.consequent;
        }

        if (body) {
          const idx = body.indexOf(child);
          const limit = idx === -1 ? body.length : idx;
          for (let i = 0; i < limit; i++) {
            const stmt = body[i];
            if (stmt.type === "VariableDeclaration" && USING_KINDS.has(stmt.kind)) {
              return true;
            }
          }
        }

        if (parent === fn) {
          break;
        }

        child = parent;
        parent = parent.parent;
      }

      return false;
    }

    function asyncInsertTarget(fn) {
      const parent = fn.parent;
      if (
        parent &&
        (parent.type === "MethodDefinition" ||
          (parent.type === "Property" && parent.method) ||
          parent.type === "PropertyDefinition")
      ) {
        return parent.key;
      }
      return fn;
    }

    return {
      ReturnStatement(node) {
        const argument = node.argument;
        if (!argument || argument.type === "AwaitExpression") {
          return;
        }

        const fn = nearestFunction(node);
        if (!fn) {
          return;
        }

        if (!hasLiveUsingInScope(node, fn)) {
          return;
        }

        if (!isThenable(argument)) {
          return;
        }

        context.report({
          node: argument,
          message: errorMessage,
          fix(fixer) {
            const fixes = [fixer.insertTextBefore(argument, "await ")];
            if (!fn.async) {
              fixes.push(fixer.insertTextBefore(asyncInsertTarget(fn), "async "));
            }
            return fixes;
          },
        });
      },
    };
  },
};
