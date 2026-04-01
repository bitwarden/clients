/*
  Use constant objects instead of enums...

  https://contributing.bitwarden.com/contributing/code-style/web/typescript#avoid-typescript-enums
*/

/*
  The different possible Magnify Item types
*/
export const MagnifyItem = Object.freeze({
  Login: "Login",
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
