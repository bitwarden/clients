export const errorMessage = "Switching to using consts instead of enums.";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce using consts instead of enums",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
  },
  create(context) {
    return {
      TSEnumDeclaration(node) {
        context.report({
          node,
          message: errorMessage,
        });
      },
    };
  },
};
