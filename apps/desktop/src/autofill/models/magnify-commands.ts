/*
  Use constant objects instead of enums...

  https://contributing.bitwarden.com/contributing/code-style/web/typescript#avoid-typescript-enums
*/

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
  | { type: typeof MagnifyCommand.CopyPassword; id: string }
  | { type: typeof MagnifyCommand.ViewInBitwarden; itemId: string }
  | { type: typeof MagnifyCommand.CopyCardNumber; itemId: string }
  | { type: typeof MagnifyCommand.CopyCardExpiration; itemId: string; format?: string }
  | { type: typeof MagnifyCommand.CopyCardCode; itemId: string };

/*
  The MagnifyCommandResponse type represents the possible values
  Magnify response commands will be, and the data they hold.
*/
export type MagnifyCommandResponse =
  | { type: typeof MagnifyCommand.SearchVault; results: MagnifyItem[] }
  | { type: typeof MagnifyCommand.CopyPassword; result: string }
  | { type: typeof MagnifyCommand.ViewInBitwarden }
  | { type: typeof MagnifyCommand.CopyCardNumber; result: string }
  | { type: typeof MagnifyCommand.CopyCardExpiration; result: string }
  | { type: typeof MagnifyCommand.CopyCardCode; result: string };

/*
  Magnify Item: unified discriminated union of all supported vault item types
*/
export type MagnifyItem =
  | ({ itemType: "login" } & MagnifyLoginItem)
  | ({ itemType: "card" } & MagnifyCardItem);

/*
  Magnify Item: Login
*/
export type MagnifyLoginItem = {
  id: string;
  name: string;
  username: string;
};

/*
  Magnify Item: Credit Card
*/
export type MagnifyCardItem = {
  id: string;
  name: string;
  brand?: string;
};
