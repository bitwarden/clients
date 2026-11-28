import { AutofillOutcome } from "../enums/autofill-outcome.enum";
import type { AutoFillOptions } from "../types";

import type { FillCancelled, FillDenied, FillInvalid, FillOccurred, FillResult } from "./types";
import type { FillOptions } from "./workflow/context";

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

/**
 * The options a caller may give a fill, taken from `options`: everything but the parts a fill
 * request carries separately (the tab, the cipher, the page details) and the options only a plan
 * decides (`allowUntrustedIframe`, `autoSubmitLogin`). The result is frozen; no options give an
 * empty one.
 *
 * Options that arrive by message, or from an untyped caller, are not type-checked, so the stripping
 * happens at runtime. The commit phase applies the plan's own values for the plan-only options
 * whatever a request carries; this keeps them out of the request too.
 *
 * @param options - The options a caller supplied, which may carry any of `AutoFillOptions`.
 */
export function omitProtectedOptions(options: Partial<AutoFillOptions> = {}): FillOptions {
  const fillOptions = { ...options };
  delete fillOptions.tab;
  delete fillOptions.cipher;
  delete fillOptions.pageDetails;
  delete fillOptions.allowUntrustedIframe;
  delete fillOptions.autoSubmitLogin;
  return Object.freeze(fillOptions);
}
