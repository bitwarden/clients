import { Decorator } from "@storybook/angular";

/**
 * Renders the story at `url`. Pair with `provideRouter(routes, withHashLocation())`: hash routing
 * leaves Storybook's own `iframe.html?id=…` query string intact.
 */
export const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };
