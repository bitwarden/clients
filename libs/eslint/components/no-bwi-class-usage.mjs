import { BWI_CLASS_RE, BWI_HELPER_CLASSES, extractIconNameFromClassValue } from "./bwi-utils.mjs";

export const errorMessage =
  "Use <bit-icon> component instead of applying 'bwi' classes directly. Example: <bit-icon name=\"bwi-lock\"></bit-icon>";

/**
 * Parse the class string and return the remaining classes and whether bwi-fw is present.
 * Drops: "bwi" base class, the icon name class, and "bwi-fw" (mapped to fixedWidth input).
 * Keeps: other helper bwi classes and non-bwi classes (tw-*, etc.)
 */
function parseClasses(classValue, iconName) {
  let hasFixedWidth = false;
  const remaining = [];
  for (const cls of classValue.split(/\s+/)) {
    if (!cls || cls === "bwi" || cls === iconName) continue;
    if (cls === "bwi-fw") {
      hasFixedWidth = true;
    } else {
      remaining.push(cls);
    }
  }
  return { hasFixedWidth, remainingClasses: remaining.join(" ") };
}

export default {
  meta: {
    type: "suggestion",
    hasSuggestions: true,
    docs: {
      description:
        "Discourage using 'bwi' font icon classes directly in favor of the <bit-icon> component",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      useBitIcon: errorMessage,
      replaceBwi: "Replace with <bit-icon>. Note: ensure IconModule is imported in your component.",
    },
    schema: [],
  },
  create(context) {
    /**
     * Creates a fixer function if the element can be safely auto-fixed.
     * Only fixes <i> elements with static class attributes and a single extractable icon name.
     */
    function createFix(node, classAttr, classValue) {
      // Only auto-fix <i> elements
      if (node.name !== "i") {
        return null;
      }

      // Only fix static class attributes (not [class] or [ngClass] bindings)
      const isStaticAttr = (node.attributes || []).includes(classAttr);
      if (!isStaticAttr) {
        return null;
      }

      // Extract the icon name -- bail if none or ambiguous
      const iconName = extractIconNameFromClassValue(classValue);
      if (!iconName) {
        return null;
      }

      // Don't fix if the element has Angular bindings, outputs, or references
      if (
        (node.inputs || []).length > 0 ||
        (node.outputs || []).length > 0 ||
        (node.references || []).length > 0
      ) {
        return null;
      }

      // Don't fix if the element has non-whitespace children (element nodes or non-empty text)
      const hasContent = (node.children || []).some(
        (child) => child.value === undefined || child.value.trim() !== "",
      );
      if (hasContent) {
        return null;
      }

      // Get remaining classes (helpers + non-bwi classes)
      const { hasFixedWidth, remainingClasses } = parseClasses(classValue, iconName);

      // Collect other attributes to preserve
      // Drop: class (rebuilt above), aria-hidden="true" (bit-icon handles it automatically)
      const otherAttrs = (node.attributes || []).filter((attr) => {
        if (attr.name === "class") return false;
        if (attr.name === "aria-hidden" && attr.value === "true") return false;
        return true;
      });

      // Build the replacement <bit-icon> element
      const attrs = [`name="${iconName}"`];
      if (hasFixedWidth) {
        attrs.push("fixedWidth");
      }
      if (remainingClasses) {
        attrs.push(`class="${remainingClasses}"`);
      }
      for (const attr of otherAttrs) {
        attrs.push(attr.value != null ? `${attr.name}="${attr.value}"` : attr.name);
      }
      const replacement = `<bit-icon ${attrs.join(" ")} />`;

      const start = node.sourceSpan.start.offset;
      const end = node.sourceSpan.end.offset;

      return (fixer) => fixer.replaceTextRange([start, end], replacement);
    }

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
          const bwiClassMatches = classValue.match(BWI_CLASS_RE);

          if (!bwiClassMatches) {
            continue;
          }

          // Check if any bwi class is NOT in the allowed helper classes list
          const hasDisallowedBwiClass = bwiClassMatches.some((cls) => !BWI_HELPER_CLASSES.has(cls));

          if (hasDisallowedBwiClass) {
            const fix = createFix(node, classAttr, classValue);

            context.report({
              node,
              messageId: "useBitIcon",
              ...(fix ? { suggest: [{ messageId: "replaceBwi", fix }] } : {}),
            });
            // Only report once per element
            break;
          }
        }
      },
    };
  },
};
