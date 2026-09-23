import { argsToTemplate, StoryObj } from "@storybook/angular";

type RenderArgType<T> = StoryObj<T>["args"];

/**
 * Escapes a string for safe interpolation into a double-quoted HTML attribute value,
 * preventing it from breaking out of the attribute and injecting markup/handlers.
 */
const escapeHtmlAttributeValue = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Only emit args whose key is a plain attribute/input name. Rejects non-identifier
 * characters and event-handler (`on*`) names so an injected arg key cannot become a
 * live DOM event handler (e.g. `onmouseover`). Function args are handled separately via
 * `argsToTemplate` and are not subject to this filter.
 */
const isSafeArgKey = (key: string): boolean => /^[a-zA-Z_][\w-]*$/.test(key) && !/^on/i.test(key);

export const formatArgsForCodeSnippet = <ComponentType extends Record<string, any>>(
  args: RenderArgType<ComponentType>,
) => {
  const nonNullArgs = Object.entries(args as ComponentType).filter(
    ([_, value]) => value !== null && value !== undefined,
  );
  const functionArgs = nonNullArgs.filter(([_, value]) => typeof value === "function");
  const argsToFormat = nonNullArgs.filter(([_, value]) => typeof value !== "function");

  const argsToTemplateIncludeKeys = [...functionArgs].map(
    ([key, _]) => key as keyof RenderArgType<ComponentType>,
  );

  const formattedNonFunctionArgs = argsToFormat
    .filter(([key]) => isSafeArgKey(key))
    .map(([key, value]) => {
      if (typeof value === "boolean") {
        return `[${key}]="${value}"`;
      }

      if (Array.isArray(value)) {
        const formattedArray = value
          .map((v) => `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`)
          .join(", ");
        // Escape the assembled expression for the double-quoted attribute context. This
        // preserves the structural `'`, `[`, `]`, and `,` while neutralizing any `"`, `<`,
        // `>`, `&` from element contents (the `\'` expression-context escaping above keeps
        // single quotes inside the JS string literal).
        return `[${key}]="${escapeHtmlAttributeValue(`[${formattedArray}]`)}"`;
      }

      if (typeof value === "number") {
        return `[${key}]="${value}"`;
      }

      return `${key}="${escapeHtmlAttributeValue(String(value))}"`;
    })
    .join(" ");

  return `${formattedNonFunctionArgs} ${argsToTemplate(args as ComponentType, { include: argsToTemplateIncludeKeys })}`;
};
