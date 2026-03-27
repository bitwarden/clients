/*
  Use constant objects instead of enums...

  https://contributing.bitwarden.com/contributing/code-style/web/typescript#avoid-typescript-enums
*/

/*
  The different possible Magnify Commands
*/
export const MagnifyCommand = Object.freeze({
  SearchVault: "SearchVault",
  CopyPassword: "CopyPassword",
} as const);
export type MagnifyCommand = (typeof MagnifyCommand)[keyof typeof MagnifyCommand];

/*
  The MagnifyCommandRequest type represents the possible values
  Magnify request commands can be, and the data they hold.
*/
export type MagnifyCommandRequest =
  | { type: typeof MagnifyCommand.SearchVault; input: string }
  | { type: typeof MagnifyCommand.CopyPassword; id: string };

/*
  The MagnifyCommandResponse type represents the possible values
  Magnify response commands will be, and the data they hold.
*/
export type MagnifyCommandResponse =
  | { type: typeof MagnifyCommand.SearchVault; results: MagnifyLoginItem[] }
  | { type: typeof MagnifyCommand.CopyPassword; result: string };

/*
  Magnify Item: Login
*/
export type MagnifyLoginItem = {
  id: string;
  name: string;
  username: string;
};
