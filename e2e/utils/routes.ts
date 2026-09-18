////
// Hash routes the tests assert on. The clients share the routing, except that
// the extension nests the vault under its tab bar.
////

/** Matches the desktop/web `#/vault` and the extension's `#/tabs/vault`. */
export const VAULT_ROUTE = /#\/(tabs\/)?vault/;

export const LOCK_ROUTE = /#\/lock/;

export const LOGIN_ROUTE = /#\/login/;
