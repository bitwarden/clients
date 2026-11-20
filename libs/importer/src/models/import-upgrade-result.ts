import { ImportResult } from "./import-result";

// TODO: remove once pm-35053-import-upgrade is retired

/** Stable identifiers for errorMessage's cause, for callers that need to branch on it (e.g. a
 *  wrong file password) without matching against the localized message text. */
export const ImportResultErrorKey = Object.freeze({
  InvalidFilePassword: "invalidFilePassword",
  AccountMismatch: "importEncKeyError",
} as const);
export type ImportResultErrorKey = (typeof ImportResultErrorKey)[keyof typeof ImportResultErrorKey];

export class ImportUpgradeResult extends ImportResult {
  /** Optional: most importers' errorMessage has no caller that needs to distinguish its cause. */
  errorKey?: ImportResultErrorKey;
}

/** Thrown by ImportUpgradeService when an ImportResult's success is false — carries errorKey alongside
 *  the localized message so a caller can branch on the cause without string-matching errorMessage. */
export class ImportResultError extends Error {
  constructor(
    message: string,
    readonly errorKey?: ImportResultErrorKey,
  ) {
    super(message);
    this.name = "ImportResultError";
  }
}
