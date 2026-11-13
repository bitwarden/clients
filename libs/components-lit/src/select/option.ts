import type { BitwardenIcon } from "../icon/shared-icon";
import type { IconTileOptions } from "../icon-tile/icon-tile-options";

/** An option of `bit-select` (Angular `Option<T>`), passed through `items` or as `bit-option`. */
export interface SelectOption<T> {
  icon?: BitwardenIcon;
  /** Renders an icon tile in place of `icon`; takes precedence when both are set. */
  iconTile?: IconTileOptions;
  value: T | null;
  label?: string;
  description?: string;
  /** Secondary text shown at the end of the row. */
  metaData?: string;
  disabled?: boolean;
}
