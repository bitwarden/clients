import { AutofillOutcome } from "../enums/autofill-outcome.enum";

import type { FillOccurred, FillDenied, FillResult } from "./types";

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
