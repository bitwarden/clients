/**
 * @fileoverview Forbid hardcoded colors in SVGs; enforce CSS variables instead.
 */

"use strict";

const COLOR_REGEX =
  /(?:fill|stroke|stop-color|flood-color|lighting-color)\s*=\s*["'](?!none["'])(?!var\(--)(#(?:[0-9a-f]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)["']/gi;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid hardcoded colors in SVGs; enforce theme variables instead.",
      category: "Best Practices",
    },
    messages: {
      hardcodedColor:
        "Hardcoded color '{{color}}' found in SVG. Use Tailwind or CSS variables instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          tagNames: {
            type: "array",
            items: { type: "string" },
            default: ["svgIcon"],
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const tagNames = options.tagNames || ["svgIcon"];

    function isSvgTaggedTemplate(node) {
      return (
        node.tag &&
        ((node.tag.type === "Identifier" && tagNames.includes(node.tag.name)) ||
          (node.tag.type === "MemberExpression" && tagNames.includes(node.tag.property.name)))
      );
    }

    return {
      TaggedTemplateExpression(node) {
        if (!isSvgTaggedTemplate(node)) return;

        const svgString = node.quasi.quasis.map((q) => q.value.raw).join("");
        let match;
        while ((match = COLOR_REGEX.exec(svgString)) !== null) {
          context.report({
            node,
            loc: context.getSourceCode().getLocFromIndex(node.range[0] + match.index),
            messageId: "hardcodedColor",
            data: { color: match[1] },
          });
        }
      },
    };
  },
};
