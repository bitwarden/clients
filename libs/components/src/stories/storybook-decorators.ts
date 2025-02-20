import { componentWrapperDecorator } from "@storybook/angular";

/**
 * Render a story that uses `position: fixed`
 * Used in layout and navigation components
 **/
export const positionFixedWrapperDecorator = (wrapper?: (story: string) => string) =>
  componentWrapperDecorator(
    /**
     * Applying a CSS transform makes a `position: fixed` element act like it is `position: relative`
     * https://github.com/storybookjs/storybook/issues/8011#issue-490251969
     */
    (story) =>
      /* HTML */ `<div
        class="tw-scale-100 tw-h-screen tw-border-2 tw-border-solid tw-border-secondary-300 tw-overflow-auto tw-box-content"
      >
        ${wrapper ? wrapper(story) : story}
      </div>`,
  );

export const disableBothThemeDecorator = componentWrapperDecorator(
  (story) => story,
  ({ globals }) => {
    /**
     * avoid a bug with the way that we render the same component twice in the same iframe and how
     * that interacts with the router-outlet
     */
    const themeOverride = globals["theme"] === "both" ? "light" : globals["theme"];
    return { theme: themeOverride };
  },
);
