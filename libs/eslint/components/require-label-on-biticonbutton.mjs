export const errorMessage =
  "Elements with 'bitIconButton' must also have a 'label' attribute for accessibility.";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a label attribute on elements with bitIconButton, except when ignored attributes are present",
      category: "Best Practices",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          ignoreIfHas: {
            type: "array",
            items: { type: "string" },
            description: "Attributes that, if present, will skip the label requirement.",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const [{ ignoreIfHas = [] } = {}] = context.options;

    return {
      Element(node) {
        const allAttrNames = [
          ...(node.attributes?.map((attr) => attr.name) ?? []),
          ...(node.inputs?.map((input) => input.name) ?? []),
          ...(node.templateAttrs?.map((attr) => attr.name) ?? []),
        ];

        const hasBitIconButton = allAttrNames.includes("bitIconButton");
        const hasLabel = allAttrNames.includes("label");
        const shouldIgnore = ignoreIfHas.some((attr) => allAttrNames.includes(attr));

        if (hasBitIconButton && !shouldIgnore && !hasLabel) {
          context.report({
            node,
            message: errorMessage,
          });
        }
      },
    };
  },
};
