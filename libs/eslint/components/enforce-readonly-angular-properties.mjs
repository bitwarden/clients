const LEGACY_DECORATOR_TO_SIGNAL = {
  Input: { messageId: "legacyInput", signal: "input()" },
  Output: { messageId: "legacyOutput", signal: "output()" },
  ViewChild: { messageId: "legacyViewChild", signal: "viewChild()" },
  ViewChildren: { messageId: "legacyViewChildren", signal: "viewChildren()" },
  ContentChild: { messageId: "legacyContentChild", signal: "contentChild()" },
  ContentChildren: { messageId: "legacyContentChildren", signal: "contentChildren()" },
};

export const messages = {
  nonReadonly: "Class properties must be readonly. Use signals for mutable state.",
  legacyInput: "Replace @Input() with the signal-based input() API. All properties must be readonly.",
  legacyOutput:
    "Replace @Output() with the signal-based output() API. All properties must be readonly.",
  legacyViewChild:
    "Replace @ViewChild() with the signal-based viewChild() API. All properties must be readonly.",
  legacyViewChildren:
    "Replace @ViewChildren() with the signal-based viewChildren() API. All properties must be readonly.",
  legacyContentChild:
    "Replace @ContentChild() with the signal-based contentChild() API. All properties must be readonly.",
  legacyContentChildren:
    "Replace @ContentChildren() with the signal-based contentChildren() API. All properties must be readonly.",
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

function findLegacyDecorator(decorators) {
  for (const d of decorators ?? []) {
    const name = getDecoratorName(d);
    if (name && LEGACY_DECORATOR_TO_SIGNAL[name]) {
      return name;
    }
  }
  return null;
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
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        if (node.readonly) return;
        if (node.declare) return;
        if (node.abstract) return;

        const legacyDecorator = findLegacyDecorator(node.decorators);
        if (legacyDecorator) {
          context.report({ node, messageId: LEGACY_DECORATOR_TO_SIGNAL[legacyDecorator].messageId });
          return;
        }

        context.report({
          node,
          messageId: "nonReadonly",
          fix: (fixer) => fixer.insertTextBefore(node.key, "readonly "),
        });
      },
      TSParameterProperty(node) {
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
