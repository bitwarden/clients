export const errorMessage =
  "Use <bit-icon> component instead of applying 'bwi' classes directly. Example: <bit-icon name=\"bwi-lock\"></bit-icon>";

// Helper classes from libs/angular/src/scss/bwicons/styles/style.scss
// These are utility classes that can be used independently
const ALLOWED_BWI_HELPER_CLASSES = new Set([
  "bwi-fw", // Fixed width
  "bwi-sm", // Small
  "bwi-lg", // Large
  "bwi-2x", // 2x size
  "bwi-3x", // 3x size
  "bwi-4x", // 4x size
  "bwi-spin", // Spin animation
  "bwi-ul", // List
  "bwi-li", // List item
  "bwi-rotate-270", // Rotation
]);

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

          if (typeof classValue !== "string") {
            continue;
          }

          // Extract all bwi classes from the class string
          const bwiClassMatches = classValue.match(/\bbwi(?:-[\w-]+)?\b/g);

          if (!bwiClassMatches) {
            continue;
          }

          // Check if any bwi class is NOT in the allowed helper classes list
          const hasDisallowedBwiClass = bwiClassMatches.some(
            (cls) => !ALLOWED_BWI_HELPER_CLASSES.has(cls),
          );

          if (hasDisallowedBwiClass) {
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
