import type { Args } from "@storybook/csf";

export const formatArgsForCodeSnippet = <ComponentType>(args: Args) => {
  const nonNullArgs = Object.entries(args).filter(
    ([_, value]) => value !== null && value !== undefined,
  );
  const functionArgs = nonNullArgs.filter(([_, value]) => typeof value === "function");

  const nonFunctionArgs = nonNullArgs.filter(([_, value]) => typeof value !== "function");
  const functionArgKeys = [...functionArgs].map(([key, _]) => key as keyof ComponentType);

  const formattedNonFunctionArgs = nonFunctionArgs
    .map(([key, value]) => {
      return `${key}="${value}"`;
    })
    .join(" ");

  return {
    formattedNonFunctionArgs,
    functionArgKeys,
  };
};
