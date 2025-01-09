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
      /* HTML */ `<div class="tw-scale-100 tw-h-screen tw-border-2 tw-border-solid tw-border-[red]">
        ${wrapper ? wrapper(story) : story}
      </div>`,
  );
