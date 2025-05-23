import { argsToTemplate, StoryObj } from "@storybook/angular";

type RenderArgType<T> = Parameters<StoryObj<T>["render"]>[0];

export const formatArgsForCodeSnippet = <ComponentType>(args: RenderArgType<ComponentType>) => {
  const nonNullArgs = Object.entries(args).filter(
    ([_, value]) => value !== null && value !== undefined,
  );
  const functionArgs = nonNullArgs.filter(([_, value]) => typeof value === "function");
  // const argsWithObjectValues = nonNullArgs.filter(([_, value]) => typeof value === "object");
  const argsToFormat = nonNullArgs.filter(([_, value]) => typeof value !== "function");

  const argsToTemplateIncludeKeys = [...functionArgs].map(
    ([key, _]) => key as keyof RenderArgType<ComponentType>,
  );

  const formattedNonFunctionArgs = argsToFormat
    .map(([key, value]) => {
      if (typeof value === "boolean") {
        return `[${key}]="${value}"`;
      }

      if (typeof value === "object" && Array.isArray(value)) {
        const formattedArray = value.map((v) => `'${v}'`).join(", ");
        return `[${key}]="[${formattedArray}]"`;
      }
      return `${key}="${value}"`;
    })
    .join(" ");

  return `${formattedNonFunctionArgs} ${argsToTemplate(args, { include: argsToTemplateIncludeKeys })}`;
};
