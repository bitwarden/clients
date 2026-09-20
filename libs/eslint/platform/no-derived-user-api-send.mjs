export const errorMessage =
  "ApiService.send(..., true, ...) is deprecated. Pass an explicit UserId (captured at operation entry) instead of relying on the active user.";

/**
 * Flags calls to `.send(...)` that use the deprecated derived-user overload —
 * i.e. any 5+ argument `.send()` where the 4th positional argument is the
 * literal `true` and the 5th is a boolean literal (matching `ApiService.send`'s
 * `authedOrUserId, hasResponse` shape).
 *
 * The narrower the match, the fewer false positives on unrelated `.send()`
 * methods (Node http, EventEmitter, jQuery, etc.).
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow calls to ApiService.send that authenticate via the derived active user",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee?.type !== "MemberExpression") {
          return;
        }
        if (node.callee.property?.type !== "Identifier" || node.callee.property.name !== "send") {
          return;
        }
        if (node.arguments.length < 5) {
          return;
        }
        const authedArg = node.arguments[3];
        const hasResponseArg = node.arguments[4];
        const isTrueLiteral = (a) => a?.type === "Literal" && a.value === true;
        const isBoolLiteral = (a) =>
          a?.type === "Literal" && (a.value === true || a.value === false);
        if (!isTrueLiteral(authedArg) || !isBoolLiteral(hasResponseArg)) {
          return;
        }
        context.report({
          node: authedArg,
          message: errorMessage,
        });
      },
    };
  },
};
