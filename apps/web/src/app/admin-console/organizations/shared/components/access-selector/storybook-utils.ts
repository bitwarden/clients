import { action } from "storybook/actions";

import { AccessItemType, AccessItemView } from "./access-selector.models";

export const actionsData = {
  onValueChanged: action("onValueChanged"),
  onSubmit: action("onSubmit"),
};

/**
 * Factory to help build semi-realistic looking items
 * @param n - The number of items to build
 * @param type - Which type to build
 */
export const itemsFactory = (n: number, type: AccessItemType) => {
  return [...Array(n)].map((_: unknown, id: number) => {
    const item: AccessItemView = {
      id: id.toString(),
      type: type,
    } as AccessItemView;

    switch (item.type) {
      case AccessItemType.Collection:
        item.labelName = item.listName = `Collection ${id}`;
        item.id = item.id + "c";
        item.parentGrouping = "Collection Parent Group " + ((id % 2) + 1);
        break;
      case AccessItemType.Group:
        item.labelName = item.listName = `Group ${id}`;
        item.id = item.id + "g";
        break;
      case AccessItemType.Member:
        item.id = item.id + "m";
        item.email = `member${id}@email.com`;
        item.status = id % 3 == 0 ? 0 : 2;
        item.labelName = item.status == 2 ? `Member ${id}` : item.email;
        item.listName = item.status == 2 ? `${item.labelName} (${item.email})` : item.email;
        item.role = id % 5;
        break;
    }

    return item;
  });
};
