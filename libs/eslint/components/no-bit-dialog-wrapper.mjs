const DIALOG_TAGS = new Set(["bit-dialog", "bit-simple-dialog"]);

export const errorMessage =
  "<bit-dialog> / <bit-simple-dialog> must be the root of its template. " +
  'Apply the selector as an attribute on the root element instead (e.g. <form bit-dialog dialogSize="large">...</form>).';

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow placing <bit-dialog> or <bit-simple-dialog> inside a parent element.",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      noWrapper: errorMessage,
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      Element(node) {
        if (!DIALOG_TAGS.has(node.name)) {
          return;
        }

        const ancestors = sourceCode.getAncestors
          ? sourceCode.getAncestors(node)
          : context.getAncestors();

        const hasElementAncestor = ancestors.some((a) => a?.constructor?.name === "Element");
        if (hasElementAncestor) {
          context.report({ node, messageId: "noWrapper" });
        }
      },
    };
  },
};
