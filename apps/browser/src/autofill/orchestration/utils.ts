import { AutofillOutcome } from "../enums/autofill-outcome.enum";

import type { FillCancelled, FillDenied, FillInvalid, FillOccurred, FillResult } from "./types";

/**
 * Returned when autofill denies a fill request.
 *
 * WARNING: This is not an identity to test against. A result that crosses a message channel is cloned,
 * so the receiver holds an equal value and not this one.
 */
export const AUTOFILL_DENIED: FillDenied = Object.freeze({ outcome: AutofillOutcome.Denied });

/**
 * Returned when a fill's token is cancelled before the fill commits.
 *
 * WARNING: This is not an identity to test against. A result that crosses a message channel is cloned,
 * so the receiver holds an equal value and not this one.
 */
export const AUTOFILL_CANCELLED: FillCancelled = Object.freeze({
  outcome: AutofillOutcome.Cancelled,
});

/**
 * Returned when a runtime check that an attempt depends on fails.
 *
 * WARNING: This is not an identity to test against. A result that crosses a message channel is cloned,
 * so the receiver holds an equal value and not this one.
 */
export const AUTOFILL_INVALID: FillInvalid = Object.freeze({ outcome: AutofillOutcome.Invalid });

/** Returned when autofill fails to fill a field and there is no TOTP available.
 *
 * WARNING: This is not an identity to test against. A result that crosses a message channel is cloned,
 * so the receiver holds an equal value and not this one.
 */
export const AUTOFILL_ABSENT: FillOccurred = Object.freeze({ outcome: AutofillOutcome.Absent });

const KNOWN_OUTCOMES = Object.freeze<ReadonlySet<unknown>>(
  new Set<unknown>(Object.values(AutofillOutcome)),
);

/**
 * Whether a value is a fill result. It is a result when it names an outcome that autofill defines,
 * which no tab, plan, or other value a step of a fill produces does. It lets a step that may end a fill with a result say
 * so in the type of what it returns.
 */
export function isFillResult(value: object): value is FillResult {
  return "outcome" in value && KNOWN_OUTCOMES.has(value.outcome);
}

/**
 * Whether a fill attempt occurred. It went ahead to the page, so the request may continue and
 * whatever the attempt released may be acted on. A denied, cancelled, or invalid attempt did not
 * occur, and each is read the same way.
 *
 * See `autofill.design.md`, "Reading an outcome".
 */
export function didFillOccur(result: FillResult): result is FillOccurred {
  // Tests for the outcomes that occur, so that any other outcome counts as not occurring.
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
