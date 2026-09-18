import { inject, provideAppInitializer } from "@angular/core";
import { applicationConfig, componentWrapperDecorator } from "@storybook/angular";

// Imported off the barrel to keep this story helper from pulling in NavigationModule.
import { SideNavService } from "../navigation/side-nav.service";

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

/**
 * Render a story with the side nav collapsed to its icon rail.
 *
 * `LayoutComponent` pushes the nav open from its constructor at Storybook's viewport width unless
 * the user has explicitly closed it, so setting `open` to `false` is not enough — `"closed"` is the
 * only value that branch defers to. An app initializer sets it before the layout is constructed; a
 * `play` function would run after first paint and the nav would flash open on the way.
 */
export const collapsedSideNavDecorator = applicationConfig({
  providers: [
    provideAppInitializer(() => {
      inject(SideNavService).userCollapsePreference.set("closed");
    }),
  ],
});
