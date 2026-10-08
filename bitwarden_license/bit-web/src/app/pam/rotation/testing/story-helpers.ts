import { Decorator } from "@storybook/angular";

/**
 * Renders the story at `url` through the hash, which keeps Storybook's query string intact. Needs
 * `provideRouter(routes, withHashLocation())`, or the story silently renders the default route.
 */
export const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };
