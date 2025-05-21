import { argsToTemplate, StoryObj } from "@storybook/angular";

type RenderArgType<T> = Parameters<StoryObj<T>["render"]>[0];

export const formatArgsForCodeSnippet = <ComponentType>(args: RenderArgType<ComponentType>) => {
  const nonNullArgs = Object.entries(args).filter(
    ([_, value]) => value !== null && value !== undefined,
  );
  const functionArgs = nonNullArgs.filter(([_, value]) => typeof value === "function");

  const nonFunctionArgs = nonNullArgs.filter(([_, value]) => typeof value !== "function");
  const functionArgKeys = [...functionArgs].map(
    ([key, _]) => key as keyof RenderArgType<ComponentType>,
  );

  const formattedNonFunctionArgs = nonFunctionArgs
    .map(([key, value]) => {
      if (typeof value === "boolean") {
        return `[${key}]="${value}"`;
      }
      return `${key}="${value}"`;
    })
    .join(" ");

  return `${formattedNonFunctionArgs} ${argsToTemplate(args, { include: functionArgKeys })}`;
};
