import { CollectionId } from "@bitwarden/common/types/guid";

export type SelectItemView = BaseSelectView & {
  id: string; // Unique ID used for comparisons - this may represent different object IDs depending on the context
};

export type SelectCollectionView = BaseSelectView & {
  id: CollectionId;
};

type BaseSelectView = {
  listName: string; // Default bindValue -> this is what will be displayed in list items
  labelName: string; // This is what will be displayed in the selection option badge
  icon?: string; // Icon to display within the list
  parentGrouping?: string; // Used to group items by parent
};
