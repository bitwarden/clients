export type SelectItemView = {
  id: string; // Unique ID used for comparisons
  listName: string; // Default bindValue -> this is what will be displayed in list items
  labelName: string; // This is what will be displayed in the selection option badge
  icon?: string; // Icon to display within the list
  parentGrouping?: string; // Used to group items by parent
};
