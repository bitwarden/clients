import { componentWrapperDecorator } from "@storybook/angular";

/**
 * Render a story that uses `position: fixed`
 * Used in layout and navigation components
 *
 * @param wrapper optional inner wrapper applied around the story content
 * @param options.border whether to draw the gray frame around the canvas
 *   (default true; pass `false` for stories whose own chrome should read
 *   without competing with the wrapper's border)
 **/
export const positionFixedWrapperDecorator = (
  wrapper?: (story: string) => string,
  options: { border?: boolean } = {},
) => {
  const border = options.border ?? true;
  const borderClasses = border ? "tw-border-2 tw-border-solid tw-border-secondary-300" : "";
  return componentWrapperDecorator(
    /**
     * Applying a CSS transform makes a `position: fixed` element act like it is `position: relative`
     * https://github.com/storybookjs/storybook/issues/8011#issue-490251969
     */
    (story) =>
      /* HTML */ `<div
        class="tw-scale-100 tw-h-screen ${borderClasses} tw-overflow-auto tw-box-content"
      >
        ${wrapper ? wrapper(story) : story}
      </div>`,
  );
};
