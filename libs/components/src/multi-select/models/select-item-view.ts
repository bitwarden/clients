import { IconTileOptions } from "../../icon-tile";
import { BitwardenIcon } from "../../shared/icon";

export type SelectItemView = {
  id: string; // Unique ID used for comparisons
  listName: string; // Default bindValue -> this is what will be displayed in list items
  labelName: string; // This is what will be displayed in the selection option badge
  icon?: BitwardenIcon | string; // Icon to display within the list
  // Icon tile to display within the list, in place of `icon`. Only applies to the list — the selected
  // item badge is a chip, which has no slot for a tile and continues to use `icon`.
  iconTile?: IconTileOptions;
  parentGrouping?: string; // Used to group items by parent
};
