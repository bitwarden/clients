import { AbstractControl, ValidationErrors } from "@angular/forms";

import {
  MAX_REQUEST_ACCESS_WINDOW_SECONDS,
  requestWindowProblem,
} from "../helpers/request-access-window";

/** The key the window validators report under, so the template can branch on the problem. */
export const REQUEST_WINDOW_ERROR_KEY = "requestWindow";

/**
 * Group-level validator for the human-path window: rejects an end at or before the start, and a
 * span past the cap the governing rule allows. The rules themselves live in
 * `helpers/request-access-window` (`requestWindowProblem`) so they stay Angular-free and
 * unit-testable without a form; this is only the reactive-forms adapter. Stays quiet while the
 * window is incomplete.
 *
 * A factory rather than a bare validator because the cap is per-rule and is not known until the
 * pre-check lands: the component rebinds this on the form once it has the bounds. `maxWindowSeconds`
 * is read through a callback rather than captured, so re-opening the fold-out against a different
 * rule does not leave a stale cap behind.
 */
export function requestWindowValidator(
  maxWindowSeconds: () => number = () => MAX_REQUEST_ACCESS_WINDOW_SECONDS,
): (control: AbstractControl) => ValidationErrors | null {
  return (control) => {
    const { date, start, end } = control.value as {
      date?: string | null;
      start?: string | null;
      end?: string | null;
    };
    const problem = requestWindowProblem({ date, start, end }, maxWindowSeconds());
    return problem == null ? null : { [REQUEST_WINDOW_ERROR_KEY]: problem };
  };
}
