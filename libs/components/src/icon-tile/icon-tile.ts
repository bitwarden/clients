import { BitwardenIcon } from "../shared/icon";

import { IconTileEmphasis, IconTileVariant } from "./icon-tile.component";

/**
 * Configuration for rendering a `bit-icon-tile` inside a list row, such as a select option.
 *
 * `size` is intentionally absent — the hosting component always renders these tiles at `xs` so that
 * every option and menu item lines up.
 */
export interface IconTileOptions {
  /** The BWI icon name */
  icon: BitwardenIcon;

  /** The visual theme of the icon tile */
  variant?: IconTileVariant;

  /** Optional custom hex color (e.g. `#175ddc`); takes precedence over `variant`/`emphasis`. */
  color?: string;

  /** Emphasis level for the decorative color families; ignored by the semantic variants. */
  emphasis?: IconTileEmphasis;
}
