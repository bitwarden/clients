export const errorMessage =
  "Elements with 'bitIconButton' must also have a 'label' attribute for accessibility.";

export default {
  rules: {
    "require-label-on-biticonbutton": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Require a label attribute on elements with bitIconButton, except when bitPasswordInputToggle is present",
          category: "Best Practices",
          recommended: false,
        },
        schema: [],
      },
      create(context) {
        return {
          Element(node) {
            const hasBitIconButton =
              node.attributes?.some((attr) => attr.name === "bitIconButton") ||
              node.inputs?.some((input) => input.name === "bitIconButton") ||
              node.templateAttrs?.some((attr) => attr.name === "bitIconButton");

            // Exclude if bitPasswordInputToggle is present as attribute, input, or templateAttr
            const hasBitPasswordInputToggle =
              node.attributes?.some((attr) => attr.name === "bitPasswordInputToggle") ||
              node.inputs?.some((input) => input.name === "bitPasswordInputToggle") ||
              node.templateAttrs?.some((attr) => attr.name === "bitPasswordInputToggle");

            if (hasBitIconButton && !hasBitPasswordInputToggle) {
              const hasLabel =
                node.attributes?.some((attr) => attr.name === "label") ||
                node.inputs?.some((input) => input.name === "label") ||
                node.templateAttrs?.some((attr) => attr.name === "label");
              if (!hasLabel) {
                context.report({
                  node,
                  message: errorMessage,
                });
              }
            }
          },
        };
      },
    },
  },
};
