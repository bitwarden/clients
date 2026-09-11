import { Decorator } from "@storybook/angular";

/**
 * Renders the story at `url`; hash routing keeps Storybook's own query string intact.
 *
 * Only takes effect on a story that provides `provideRouter(routes, withHashLocation())`. Under
 * the default `PathLocationStrategy` the hash is ignored and the story renders at the default
 * route, with nothing raised to say so.
 */
export const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };
