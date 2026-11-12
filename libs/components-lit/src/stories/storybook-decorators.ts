import type { Decorator } from "@storybook/web-components-vite";
import { TemplateResult } from "lit";

import { positionFixedWrapper } from "../navigation/story-helpers";

/**
 * Renders a story that uses `position: fixed` (layouts and navigation) inside a transformed frame,
 * so fixed elements stay within the story.
 *
 * @param options.border whether to draw the gray frame around the canvas (default true; pass `false`
 *   for stories whose own chrome should read without competing with the wrapper's border)
 *
 * The Angular `collapsedSideNavDecorator` has no decorator equivalent: give the layout its own
 * state with `.sideNavState=${storyNavState({ collapsed: true })}` instead.
 *
 * @internal Stories only.
 */
export const positionFixedWrapperDecorator =
  (options: { border?: boolean } = {}): Decorator =>
  (story) =>
    positionFixedWrapper(story() as TemplateResult, options.border ?? true);
