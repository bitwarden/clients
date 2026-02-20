export const errorMessage =
  'Avoid placing icon elements (<i class="bwi ..."> or <bit-icon>) inside a bitButton or bitLink. ' +
  "Use the [startIcon] or [endIcon] inputs instead. " +
  'Example: <button bitButton startIcon="bwi-plus">Label</button>';

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Discourage using icon child elements inside bitButton; use startIcon/endIcon inputs instead",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    return {
      Element(node) {
        if (node.name !== "button" && node.name !== "a") {
          return;
        }

        const allAttrNames = [
          ...(node.attributes?.map((attr) => attr.name) ?? []),
          ...(node.inputs?.map((input) => input.name) ?? []),
        ];

        if (!allAttrNames.includes("bitButton") && !allAttrNames.includes("bitLink")) {
          return;
        }

        for (const child of node.children ?? []) {
          if (!child.name) {
            continue;
          }

          // <bit-icon> child
          if (child.name === "bit-icon") {
            context.report({
              node: child,
              message: errorMessage,
            });
            continue;
          }

          // <i> child with bwi class
          if (child.name === "i") {
            const classAttrs = [
              ...(child.attributes?.filter((attr) => attr.name === "class") ?? []),
              ...(child.inputs?.filter((input) => input.name === "class") ?? []),
            ];

            for (const classAttr of classAttrs) {
              const classValue = classAttr.value || "";

              if (typeof classValue !== "string") {
                continue;
              }

              if (/\bbwi\b/.test(classValue)) {
                context.report({
                  node: child,
                  message: errorMessage,
                });
                break;
              }
            }
          }
        }
      },
    };
  },
};
