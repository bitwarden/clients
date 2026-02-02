export const errorMessage =
  "Use <bit-icon> component instead of applying 'bwi' classes directly. Example: <bit-icon name=\"bwi-lock\"></bit-icon>";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Discourage using 'bwi' font icon classes directly in favor of the <bit-icon> component",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    return {
      Element(node) {
        // Get all class-related attributes
        const classAttrs = [
          ...(node.attributes?.filter((attr) => attr.name === "class") ?? []),
          ...(node.inputs?.filter((input) => input.name === "class") ?? []),
          ...(node.templateAttrs?.filter((attr) => attr.name === "class") ?? []),
        ];

        for (const classAttr of classAttrs) {
          const classValue = classAttr.value || "";

          // Check if the class value contains 'bwi' or 'bwi-'
          // This handles both string literals and template expressions
          const hasBwiClass =
            typeof classValue === "string" && /\bbwi(?:-[\w-]+)?\b/.test(classValue);

          if (hasBwiClass) {
            context.report({
              node,
              message: errorMessage,
            });
            // Only report once per element
            break;
          }
        }
      },
    };
  },
};
