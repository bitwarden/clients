const { ESLintUtils } = require("@typescript-eslint/utils");

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce using keyword when taking a value from Rc",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
  },
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    // Function to check if a node is calling `.take()` on an `Rc` type
    function isCallingTakeOnRc(node) {
      if (
        node.type === "CallExpression" &&
        node.callee.type === "MemberExpression" &&
        node.callee.property.name === "take"
      ) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node.callee.object);
        const objectType = checker.getTypeAtLocation(tsNode);
        const typeName = checker.typeToString(objectType);

        return typeName.startsWith("Rc<"); // Confirm it’s an `Rc`
      }
      return false;
    }

    return {
      VariableDeclarator(node) {
        // Skip if using is already present
        if (node.parent.type === "VariableDeclaration" && node.parent.kind === "using") {
          return;
        }

        // Check if `.take()` is called in the initializer
        if (node.init && isCallingTakeOnRc(node.init)) {
          const variableName = node.id.name;
          context.report({
            node,
            message: `Use 'using ${variableName} = ...' when calling take() on Rc objects.`,
          });
        }
      },
      AssignmentExpression(node) {
        // Check if `.take()` is assigned to a variable
        if (isCallingTakeOnRc(node.right)) {
          const variableName = node.left.type === "Identifier" ? node.left.name : "<unknown>";

          context.report({
            node,
            message: `Use 'using ${variableName} = ...' when calling take() on Rc objects.`,
          });
        }
      },
    };
  },
};
