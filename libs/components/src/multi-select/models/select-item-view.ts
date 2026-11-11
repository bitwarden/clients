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
  // Icon shown after `iconTile` in the list, for rows that need both a status tile and a subject icon.
  // Ignored without `iconTile`, and never shown on the selected item badge.
  iconAfterTile?: BitwardenIcon | string;
  // Secondary line under `listName` in the list.
  hint?: string;
  // Greys the item out and keeps it from being selected. Items already selected stay removable.
  disabled?: boolean;
  parentGrouping?: string; // Used to group items by parent
};
