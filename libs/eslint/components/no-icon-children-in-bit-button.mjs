import { extractIconNameFromClassValue } from "./bwi-utils.mjs";

export const errorMessage =
  'Avoid placing icon elements (<i class="bwi ..."> or <bit-icon>) inside a bitButton or bitLink. ' +
  "Use the [startIcon] or [endIcon] inputs instead. " +
  'Example: <button bitButton startIcon="bwi-plus">Label</button>';

/**
 * Extract the icon name from a child element.
 * Supports both <i class="bwi bwi-xxx"> and <bit-icon name="bwi-xxx">.
 * Returns null if the icon name cannot be determined.
 */
function extractIconName(child) {
  if (child.name === "bit-icon") {
    const nameAttr = (child.attributes || []).find((a) => a.name === "name");
    return nameAttr && typeof nameAttr.value === "string" ? nameAttr.value : null;
  }

  if (child.name === "i") {
    const classAttr = (child.attributes || []).find((a) => a.name === "class");
    if (!classAttr || typeof classAttr.value !== "string") return null;
    return extractIconNameFromClassValue(classAttr.value);
  }

  return null;
}

// Classes that can safely be dropped when converting to startIcon/endIcon
// because the button component handles the equivalent spacing internally.
const DROPPABLE_CLASSES = new Set(["tw-mr-2", "tw-ml-2", "tw-ms-2", "tw-me-2"]);

/**
 * Check whether the icon child is simple enough for a clean suggestion.
 * Returns false if the child has extra classes, attributes, or bindings
 * that would be lost when converting to startIcon/endIcon.
 */
function isSimpleIconChild(child) {
  if ((child.inputs || []).length > 0) return false;

  const hasContent = (child.children || []).some(
    (c) => c.value === undefined || (typeof c.value === "string" && c.value.trim() !== ""),
  );
  if (hasContent) return false;

  if (child.name === "i") {
    const otherAttrs = (child.attributes || []).filter(
      (a) => a.name !== "class" && !(a.name === "aria-hidden" && a.value === "true"),
    );
    if (otherAttrs.length > 0) return false;

    const classAttr = (child.attributes || []).find((a) => a.name === "class");
    if (!classAttr) return false;
    const classes = (classAttr.value || "").split(/\s+/).filter(Boolean);
    return !classes.some((cls) => !cls.startsWith("bwi") && !DROPPABLE_CLASSES.has(cls));
  }

  if (child.name === "bit-icon") {
    const otherAttrs = (child.attributes || []).filter((a) => {
      if (a.name === "name") return false;
      if (a.name === "aria-hidden" && a.value === "true") return false;
      if (a.name === "class") {
        const classes = (a.value || "").split(/\s+/).filter(Boolean);
        return classes.some((cls) => !DROPPABLE_CLASSES.has(cls));
      }
      return true;
    });
    return otherAttrs.length === 0;
  }

  return false;
}

/**
 * Determine whether the icon child is at the start or end of the parent's content.
 * Returns "start", "end", or null (ambiguous).
 */
function getIconPosition(parent, iconChild) {
  const children = parent.children || [];
  const meaningfulChildren = children.filter(
    (child) => child.name || (typeof child.value === "string" && child.value.trim() !== ""),
  );

  if (meaningfulChildren.length === 0) return "start";

  const index = meaningfulChildren.indexOf(iconChild);
  if (index === 0) return "start";
  if (index === meaningfulChildren.length - 1) return "end";
  return null;
}

export default {
  meta: {
    type: "suggestion",
    hasSuggestions: true,
    docs: {
      description:
        "Discourage using icon child elements inside bitButton; use startIcon/endIcon inputs instead",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      noIconChildren: errorMessage,
      useStartIcon: "Replace with startIcon input on the parent element.",
      useEndIcon: "Replace with endIcon input on the parent element.",
    },
    schema: [],
  },
  create(context) {
    /**
     * Creates suggestions for replacing an icon child with startIcon/endIcon.
     * Returns an empty array if the icon cannot be safely converted.
     */
    function createSuggestions(parent, iconChild) {
      const iconName = extractIconName(iconChild);
      if (!iconName) return [];

      if (!isSimpleIconChild(iconChild)) return [];

      const parentAttrNames = [
        ...(parent.attributes?.map((a) => a.name) ?? []),
        ...(parent.inputs?.map((i) => i.name) ?? []),
      ];

      const position = getIconPosition(parent, iconChild);

      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const text = sourceCode.getText();

      const makeFix = (inputName) => (fixer) => {
        const insertOffset = parent.startSourceSpan.end.offset - 1;

        const {
          start: { offset: removeStart },
          end: { offset: removeEnd },
        } = iconChild.sourceSpan;

        return [
          fixer.insertTextBeforeRange([insertOffset, insertOffset], ` ${inputName}="${iconName}"`),
          fixer.removeRange([
            inputName === "startIcon"
              ? removeStart
              : removeStart - text.slice(0, removeStart).match(/ *$/)[0].length,
            inputName === "startIcon"
              ? removeEnd + text.slice(removeEnd).match(/^ */)[0].length
              : removeEnd,
          ]),
        ];
      };

      const suggestions = [];

      if ((position === "start" || position === null) && !parentAttrNames.includes("startIcon")) {
        suggestions.push({
          messageId: "useStartIcon",
          fix: makeFix("startIcon"),
        });
      }

      if ((position === "end" || position === null) && !parentAttrNames.includes("endIcon")) {
        suggestions.push({
          messageId: "useEndIcon",
          fix: makeFix("endIcon"),
        });
      }

      return suggestions;
    }

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
            const suggest = createSuggestions(node, child);
            context.report({
              node: child,
              messageId: "noIconChildren",
              ...(suggest.length ? { suggest } : {}),
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
                const suggest = createSuggestions(node, child);
                context.report({
                  node: child,
                  messageId: "noIconChildren",
                  ...(suggest.length ? { suggest } : {}),
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
