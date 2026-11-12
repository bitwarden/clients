import type { BitwardenIcon } from "../icon/shared-icon";
import type { IconTileOptions } from "../icon-tile/icon-tile-options";

export type SelectItemView = {
  /** Unique ID used for comparisons. Submitted with the form. */
  id: string;
  /** Displayed in the list. Also what the search filters on. */
  listName: string;
  /** Displayed in the chip of a selected item. */
  labelName: string;
  /** Icon to display within the list and the chip. */
  icon?: BitwardenIcon | string;
  /**
   * Icon tile to display within the list, in place of `icon`. Only applies to the list — the
   * selected item is a chip, which has no slot for a tile and continues to use `icon`.
   */
  iconTile?: IconTileOptions;
  /** Used to group items by parent. */
  parentGrouping?: string;
};
