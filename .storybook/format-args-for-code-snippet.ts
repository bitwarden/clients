import { argsToTemplate, StoryObj } from "@storybook/angular";

type RenderArgType<T> = StoryObj<T>["args"];

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
    .map(([key, value]) => {
      if (typeof value === "boolean") {
        return `[${key}]="${value}"`;
      }

      if (Array.isArray(value)) {
        const formattedArray = value.map((v) => `'${v}'`).join(", ");
        return `[${key}]="[${formattedArray}]"`;
      }

      if (typeof value === "number") {
        return `[${key}]="${value}"`;
      }

      return `${key}="${value}"`;
    })
    .join(" ");

  return `${formattedNonFunctionArgs} ${argsToTemplate(args as ComponentType, { include: argsToTemplateIncludeKeys })}`;
};
