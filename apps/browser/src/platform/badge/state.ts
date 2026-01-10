import { BadgeIcon } from "./icon";

const UnsetValue = Symbol("Unset badge state");

export const Unset = UnsetValue as typeof UnsetValue;
export type Unset = typeof Unset;

export type BadgeState = {
  /**
   * The text to display in the badge.
   * If this is set to `Unset`, any text set by a lower priority state will be cleared.
   * If this is set to `undefined`, a lower priority state may be used.
   * If no lower priority state is set, no text will be displayed.
   */
  text?: string | Unset;

  /**
   * The background color of the badge.
   * This should be a 3 or 6 character hex color code (e.g. `#f00` or `#ff0000`).
   * If this is set to `Unset`, any color set by a lower priority state will be cleared/
   * If this is set to `undefined`, a lower priority state may be used.
   * If no lower priority state is set, the default color will be used.
   */
  backgroundColor?: string | Unset;

  /**
   * The icon to display in the badge.
   * This should be a URL to an image file.
   * If this is set to `Unset`, any icon set by a lower priority state will be cleared.
   * If this is set to `undefined`, a lower priority state may be used.
   * If no lower priority state is set, the default icon will be used.
   */
  icon?: Unset | BadgeIcon;
};
