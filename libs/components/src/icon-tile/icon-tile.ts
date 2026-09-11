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

/**
 * Resolves the icon tile variant for a list option.
 * A disabled option's tile drops to the neutral `gray` family so the leading visual reads as
 * inactive alongside the muted label instead of staying fully saturated.
 */
export function resolveIconTileVariant(
  tile: IconTileOptions | undefined,
  disabled: boolean | undefined,
): IconTileVariant {
  return disabled ? "gray" : (tile?.variant ?? "primary");
}

/**
 * Resolves the icon tile color for a list option.
 * A custom color is ignored while disabled, otherwise it would override the neutral variant.
 */
export function resolveIconTileColor(
  tile: IconTileOptions | undefined,
  disabled: boolean | undefined,
): string | undefined {
  return disabled ? undefined : tile?.color;
}
