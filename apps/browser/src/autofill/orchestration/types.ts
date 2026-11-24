import { AutofillOutcome } from "../enums/autofill-outcome.enum";

/**
 * The result of a fill attempt that went ahead to the page, and the TOTP code it releases. The
 * request may continue from it.
 *
 * A code is released only by an attempt the request may continue from, so a caller holding one of
 * these may act on it. See `autofill.design.md`, "Reading an outcome".
 */
export type FillOccurred = {
  readonly outcome: typeof AutofillOutcome.Filled | typeof AutofillOutcome.Absent;
  /**
   * The current value of the cipher's TOTP code, when the cipher carries one and the user is
   * entitled to verification codes for it.
   */
  readonly totp?: string;
  /**
   * Whether the user's preference permits copying {@link totp} without being asked. Inspect it
   * through {@link shouldAutoCopyTotp} rather than reading it directly.
   */
  readonly canAutoCopyTotp?: boolean;
};

/** The result of a refused fill attempt. Carries no TOTP: a denial releases nothing. */
export type FillDenied = { readonly outcome: typeof AutofillOutcome.Denied };

/**
 * The result of a fill attempt whose token was cancelled before it committed.
 * Carries no TOTP: a cancelled fill releases nothing, and is read as a denial is.
 */
export type FillCancelled = { readonly outcome: typeof AutofillOutcome.Cancelled };

/**
 * The result of a fill attempt that a failed runtime check stopped. Carries no TOTP: an invalid
 * fill releases nothing, and is read as a denial is.
 */
export type FillInvalid = { readonly outcome: typeof AutofillOutcome.Invalid };

/** The result of a fill attempt. */
export type FillResult = FillOccurred | FillDenied | FillCancelled | FillInvalid;
