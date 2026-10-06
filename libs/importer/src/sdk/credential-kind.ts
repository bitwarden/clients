/**
 * Declares the credentials an SDK-backed importer needs so the entry points (web/desktop/browser
 * dialog, CLI flags) can collect them generically, without branching on the specific format.
 */
export const CredentialKind = Object.freeze({
  /** No credentials required. */
  none: "none",
  /** A single password/passphrase. */
  password: "password",
  /** A password plus an optional key file (e.g. KeePass KDBX). */
  passwordWithKeyFile: "passwordWithKeyFile",
} as const);

export type CredentialKind = (typeof CredentialKind)[keyof typeof CredentialKind];
