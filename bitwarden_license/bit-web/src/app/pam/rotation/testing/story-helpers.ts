import { Decorator } from "@storybook/angular";

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
export const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };
