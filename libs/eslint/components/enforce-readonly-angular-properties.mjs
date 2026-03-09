const LEGACY_DECORATORS = new Set([
  "Input",
  "Output",
  "ViewChild",
  "ViewChildren",
  "ContentChild",
  "ContentChildren",
]);

export const messages = {
  nonReadonly: "Class properties must be readonly. Use signals for mutable state.",
};

function getDecoratorName(decorator) {
  const { expression } = decorator;
  if (expression.type === "Identifier") {
    return expression.name;
  }
  if (expression.type === "CallExpression" && expression.callee.type === "Identifier") {
    return expression.callee.name;
  }
  return null;
}

function hasLegacyDecorator(decorators) {
  return (decorators ?? []).some((d) => {
    const name = getDecoratorName(d);
    return name && LEGACY_DECORATORS.has(name);
  });
}

function getNearestClass(node) {
  let current = node.parent;
  while (current) {
    if (current.type === "ClassDeclaration" || current.type === "ClassExpression") {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function isOnPushComponent(classNode) {
  for (const decorator of classNode.decorators ?? []) {
    const { expression } = decorator;
    if (expression.type !== "CallExpression") continue;
    if (expression.callee.type !== "Identifier" || expression.callee.name !== "Component") continue;

    const [optionsArg] = expression.arguments;
    if (!optionsArg || optionsArg.type !== "ObjectExpression") continue;

    for (const prop of optionsArg.properties) {
      if (prop.type !== "Property") continue;
      if (prop.key.type !== "Identifier" || prop.key.name !== "changeDetection") continue;

      const { value } = prop;
      if (
        value.type === "MemberExpression" &&
        value.object.type === "Identifier" &&
        value.object.name === "ChangeDetectionStrategy" &&
        value.property.type === "Identifier" &&
        value.property.name === "OnPush"
      ) {
        return true;
      }
    }
  }
  return false;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce readonly on all class properties in Angular components, directives, and services",
      category: "Best Practices",
      recommended: false,
    },
    fixable: "code",
    messages,
    schema: [
      {
        type: "object",
        properties: {
          onlyOnPush: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const onlyOnPush = context.options[0]?.onlyOnPush ?? false;

    function shouldCheck(node) {
      if (!onlyOnPush) return true;
      const classNode = getNearestClass(node);
      return classNode != null && isOnPushComponent(classNode);
    }

    return {
      PropertyDefinition(node) {
        if (!shouldCheck(node)) return;
        if (node.readonly) return;
        if (node.declare) return;
        if (node.abstract) return;

        if (hasLegacyDecorator(node.decorators)) {
          return;
        }

        context.report({
          node,
          messageId: "nonReadonly",
          fix: (fixer) => (node.computed ? null : fixer.insertTextBefore(node.key, "readonly ")),
        });
      },
      TSParameterProperty(node) {
        if (!shouldCheck(node)) return;
        if (node.readonly) return;

        context.report({
          node,
          messageId: "nonReadonly",
          fix: (fixer) => fixer.insertTextBefore(node.parameter, "readonly "),
        });
      },
    };
  },
};
