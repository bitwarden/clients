/*
  Use constant objects instead of enums...

  https://contributing.bitwarden.com/contributing/code-style/web/typescript#avoid-typescript-enums
*/

/*
  The different possible Magnify Item types
*/
export const MagnifyItem = Object.freeze({
  Login: "Login",
  Card: "Card",
} as const);
export type MagnifyItem = (typeof MagnifyItem)[keyof typeof MagnifyItem];

/*
  Magnify Item: Login
  Represents a login cipher returned in Magnify search results.
*/
export type MagnifyLoginItem = {
  id: string;
  name: string;
  username: string;
  iconUrl: string | null;
};

/*
  Magnify Item: Credit Card
  Represents a card cipher returned in Magnify search results.
*/
export type MagnifyCardItem = {
  id: string;
  name: string;
  brand?: string;
};

/*
  Unified discriminated union of all supported vault item types
  returned in SearchVault results.
*/
export type MagnifySearchResultItem =
  | ({ itemType: typeof MagnifyItem.Login } & MagnifyLoginItem)
  | ({ itemType: typeof MagnifyItem.Card } & MagnifyCardItem);

export function isMagnifyLoginItem(
  item: MagnifySearchResultItem,
): item is { itemType: typeof MagnifyItem.Login } & MagnifyLoginItem {
  return item.itemType === MagnifyItem.Login;
}

export function isMagnifyCardItem(
  item: MagnifySearchResultItem,
): item is { itemType: typeof MagnifyItem.Card } & MagnifyCardItem {
  return item.itemType === MagnifyItem.Card;
}
