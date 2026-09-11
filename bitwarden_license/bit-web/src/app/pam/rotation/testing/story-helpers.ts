import { Decorator } from "@storybook/angular";

/** Renders the story at `url`. */
export const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };
