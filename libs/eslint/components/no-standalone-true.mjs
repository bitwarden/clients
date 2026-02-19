export const errorMessage =
  "Redundant 'standalone: true'. Angular defaults to standalone, so this property can be removed.";

const ANGULAR_DECORATORS = new Set(["Component", "Directive", "Pipe"]);

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow redundant standalone: true in Angular @Component, @Directive, and @Pipe decorators",
      category: "Best Practices",
      recommended: true,
    },
    fixable: "code",
    schema: [],
    messages: {
      noStandaloneTrue: errorMessage,
    },
  },
  create(context) {
    return {
      Decorator(node) {
        if (!node.expression || node.expression.type !== "CallExpression") {
          return;
        }

        const callee = node.expression.callee;
        if (!callee || callee.type !== "Identifier" || !ANGULAR_DECORATORS.has(callee.name)) {
          return;
        }

        const args = node.expression.arguments;
        if (!args || args.length === 0) {
          return;
        }

        const metadata = args[0];
        if (metadata.type !== "ObjectExpression") {
          return;
        }

        const standaloneProperty = metadata.properties.find(
          (prop) =>
            prop.type === "Property" &&
            ((prop.key.type === "Identifier" && prop.key.name === "standalone") ||
              (prop.key.type === "Literal" && prop.key.value === "standalone")) &&
            prop.value &&
            prop.value.type === "Literal" &&
            prop.value.value === true,
        );

        if (!standaloneProperty) {
          return;
        }

        context.report({
          node: standaloneProperty,
          messageId: "noStandaloneTrue",
          fix(fixer) {
            const sourceCode = context.sourceCode ?? context.getSourceCode();
            const properties = metadata.properties;
            const propIndex = properties.indexOf(standaloneProperty);

            if (properties.length === 1) {
              const openBrace = sourceCode.getFirstToken(metadata);
              const closeBrace = sourceCode.getLastToken(metadata);
              return fixer.replaceTextRange([openBrace.range[1], closeBrace.range[0]], "");
            }

            if (propIndex < properties.length - 1) {
              const nextProperty = properties[propIndex + 1];
              return fixer.removeRange([standaloneProperty.range[0], nextProperty.range[0]]);
            }

            const tokenAfterPrev = sourceCode.getTokenAfter(properties[propIndex - 1]);
            return fixer.removeRange([tokenAfterPrev.range[0], standaloneProperty.range[1]]);
          },
        });
      },
    };
  },
};
