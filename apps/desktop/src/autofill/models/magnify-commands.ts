/*
  Use constant objects instead of enums...

  https://contributing.bitwarden.com/contributing/code-style/web/typescript#avoid-typescript-enums
*/

import { MagnifyLoginItem } from "./magnify-items";
export type { MagnifyLoginItem };

/*
  The default format used when copying a card expiration date.
*/
export const DEFAULT_CARD_EXPIRATION_FORMAT = "MM/YYYY";

/*
  The different possible Magnify Commands
*/
export const MagnifyCommand = Object.freeze({
  SearchVault: "SearchVault",
  CopyPassword: "CopyPassword",
  ViewInBitwarden: "ViewInBitwarden",
  CopyCardNumber: "CopyCardNumber",
  CopyCardExpiration: "CopyCardExpiration",
  CopyCardCode: "CopyCardCode",
} as const);
export type MagnifyCommand = (typeof MagnifyCommand)[keyof typeof MagnifyCommand];

/*
  The MagnifyCommandRequest type represents the possible values
  Magnify request commands can be, and the data they hold.
*/
export type MagnifyCommandRequest =
  | { type: typeof MagnifyCommand.SearchVault; input: string }
  | { type: typeof MagnifyCommand.CopyPassword; itemId: string }
  | { type: typeof MagnifyCommand.ViewInBitwarden; itemId: string }
  | { type: typeof MagnifyCommand.CopyCardNumber; itemId: string }
  | { type: typeof MagnifyCommand.CopyCardExpiration; itemId: string; format?: string }
  | { type: typeof MagnifyCommand.CopyCardCode; itemId: string };

/*
  The MagnifyCommandResponse type represents the possible values
  Magnify response commands will be, and the data they hold.
*/
export type MagnifyCommandResponse =
  | { type: typeof MagnifyCommand.SearchVault; results: MagnifySearchResultItem[] }
  | { type: typeof MagnifyCommand.CopyPassword; result: string }
  | { type: typeof MagnifyCommand.ViewInBitwarden }
  | { type: typeof MagnifyCommand.CopyCardNumber; result: string }
  | { type: typeof MagnifyCommand.CopyCardExpiration; result: string }
  | { type: typeof MagnifyCommand.CopyCardCode; result: string };

/*
  Magnify Search Result Item: unified discriminated union of all supported vault item types
  returned in SearchVault results.
*/
export type MagnifySearchResultItem =
  | ({ itemType: "login" } & MagnifyLoginItem)
  | ({ itemType: "card" } & MagnifyCardItem);

export function isMagnifyLoginItem(
  item: MagnifySearchResultItem,
): item is { itemType: "login" } & MagnifyLoginItem {
  return item.itemType === "login";
}

export function isMagnifyCardItem(
  item: MagnifySearchResultItem,
): item is { itemType: "card" } & MagnifyCardItem {
  return item.itemType === "card";
}

/*
  Magnify Item: Credit Card
*/
export type MagnifyCardItem = {
  id: string;
  name: string;
  brand?: string;
};
