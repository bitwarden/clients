/**
 * @fileoverview ESLint rule to prevent page script URL leakage vulnerabilities
 * @description This rule detects the specific security vulnerability where DOM script elements
 * receive extension URLs through chrome.runtime.getURL() or browser.runtime.getURL() calls.
 * This pattern exposes predictable extension URLs to web pages, enabling fingerprinting attacks.
 */

export const errorMessage =
  "Script injection with extension URL exposes asset urls. Use secure page script registration instead.";

/**
 * Checks if a node is a call to chrome.runtime.getURL() or browser.runtime.getURL()
 * @param {Object} node - The AST node to check
 * @returns {boolean} True if the node is an extension URL call
 */
function isExtensionURLCall(node) {
  return (
    node &&
    node.type === "CallExpression" &&
    node.callee &&
    node.callee.type === "MemberExpression" &&
    node.callee.object &&
    node.callee.object.type === "MemberExpression" &&
    node.callee.object.object &&
    ["chrome", "browser"].includes(node.callee.object.object.name) &&
    node.callee.object.property &&
    node.callee.object.property.name === "runtime" &&
    node.callee.property &&
    node.callee.property.name === "getURL"
  );
}

/**
 * Checks if a node is a call to createElement("script")
 * @param {Object} node - The AST node to check
 * @returns {boolean} True if the node creates a script element
 */
function isScriptCreation(node) {
  return (
    node &&
    node.type === "CallExpression" &&
    node.callee &&
    node.callee.type === "MemberExpression" &&
    node.callee.property &&
    node.callee.property.name === "createElement" &&
    node.arguments &&
    node.arguments.length === 1 &&
    node.arguments[0] &&
    node.arguments[0].type === "Literal" &&
    node.arguments[0].value === "script"
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent page script URL leakage through extension runtime.getURL calls",
      category: "Security",
      recommended: true,
    },
    schema: [],
    messages: {
      pageScriptUrlLeakage: errorMessage,
    },
  },

  create(context) {
    const scriptVariables = new Set();

    return {
      // Track createElement("script") calls to identify script variables
      VariableDeclarator(node) {
        if (node.init && isScriptCreation(node.init) && node.id && node.id.name) {
          scriptVariables.add(node.id.name);
        }
      },

      // Track assignments where script elements are created
      AssignmentExpression(node) {
        // Track script element creation: variable = document.createElement("script")
        if (
          node.operator === "=" &&
          node.left &&
          node.left.type === "Identifier" &&
          isScriptCreation(node.right)
        ) {
          scriptVariables.add(node.left.name);
        }

        // Check for script.src = extension URL pattern
        if (
          node.operator === "=" &&
          node.left &&
          node.left.type === "MemberExpression" &&
          node.left.property &&
          node.left.property.name === "src" &&
          isExtensionURLCall(node.right)
        ) {
          // Only flag if this is a script element assignment
          if (
            node.left.object &&
            node.left.object.type === "Identifier" &&
            scriptVariables.has(node.left.object.name)
          ) {
            context.report({
              node: node.right,
              messageId: "pageScriptUrlLeakage",
            });
          }
        }
      },
    };
  },
};
