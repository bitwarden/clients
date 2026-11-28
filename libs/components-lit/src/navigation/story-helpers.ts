import { html, TemplateResult } from "lit";

import { SideNavState } from "./side-nav-state";

/**
 * Applying a CSS transform makes a `position: fixed` element act like it is `position: relative`
 * (storybookjs/storybook#8011), so overlay-mode navs stay inside the story.
 *
 * @internal Stories only.
 */
export const positionFixedWrapper = (content: TemplateResult, border = true) =>
  html`<div
    class="tw-scale-100 tw-h-screen tw-overflow-auto tw-box-content ${
      border ? "tw-border-2 tw-border-solid tw-border-secondary-300" : ""
    }"
  >
    ${content}
  </div>`;

/**
 * A fresh, unpersisted side nav state per story, so stories on a docs page don't share it.
 * `collapsed` renders the nav collapsed to its icon rail.
 *
 * @internal Stories only.
 */
export function storyNavState({ collapsed = false } = {}): SideNavState {
  const state = new SideNavState(null);
  if (collapsed) {
    state.userCollapsePreference = "closed";
  }
  return state;
}

export type LayoutStoryArgs = { legacy: boolean; collapsed?: boolean };

/** @internal Stories only. */
export const inLayout = (
  args: LayoutStoryArgs,
  content: TemplateResult,
  { sideNav = true, rounded = false } = {},
) =>
  positionFixedWrapper(
    html`<bit-layout
      ?legacy=${args.legacy}
      ?rounded=${rounded}
      .sideNavState=${storyNavState({ collapsed: args.collapsed })}
    >
      ${sideNav ? html`<bit-side-nav>${content}</bit-side-nav>` : content}
    </bit-layout>`,
  );
