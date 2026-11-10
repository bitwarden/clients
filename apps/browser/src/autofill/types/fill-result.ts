import { AutofillOutcome } from "../enums/autofill-outcome.enum";

/**
 * The result of a fill attempt that was not refused, and the TOTP code it releases.
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

/** The result of a fill attempt. */
export type FillResult = FillOccurred | FillDenied;

/**
 * Returned when autofill denies a fill request.
 *
 * WARNING: This is not an identity to test against. A result that crosses a message channel is cloned,
 * so the receiver holds an equal value and not this one.
 */
export const AUTOFILL_DENIED: FillDenied = Object.freeze({ outcome: AutofillOutcome.Denied });

/** Returned when autofill fails to fill a field and there is no TOTP available.
 *
 * WARNING: This is not an identity to test against. A result that crosses a message channel is cloned,
 * so the receiver holds an equal value and not this one.
 */
export const AUTOFILL_ABSENT: FillOccurred = Object.freeze({ outcome: AutofillOutcome.Absent });

/**
 * Whether a fill attempt occurred. It was not refused, so the request may continue and whatever
 * the attempt released may be acted on.
 *
 * See `autofill.design.md`, "Reading an outcome".
 */
export function didFillOccur(result: FillResult): result is FillOccurred {
  // Tests for the outcomes that did occur rather than for the absence of a refusal, so an
  // outcome added later is excluded until it is considered
  return result.outcome === AutofillOutcome.Filled || result.outcome === AutofillOutcome.Absent;
}

/**
 * Whether a released TOTP code should be copied without asking the user — the attempt occurred, it
 * released a code, and the user's preference permits copying it.
 *
 * See `autofill.design.md`, "Reading an outcome".
 */
export function shouldAutoCopyTotp(result: FillResult): result is FillOccurred & { totp: string } {
  return didFillOccur(result) && result.canAutoCopyTotp === true && result.totp !== undefined;
}
