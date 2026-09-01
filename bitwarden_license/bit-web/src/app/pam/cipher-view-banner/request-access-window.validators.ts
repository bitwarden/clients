import { AbstractControl, ValidationErrors } from "@angular/forms";

import {
  type RequestWindowFormValue,
  type RequestWindowProblem,
  requestWindowProblem,
} from "../helpers/request-access-window";

/** The key the window validator reports its {@link RequestWindowError} under. */
export const REQUEST_WINDOW_ERROR_KEY = "requestWindow";

/**
 * The shape reported under {@link REQUEST_WINDOW_ERROR_KEY}. `message` is already localized so
 * `bit-error` renders it through its `error[1].message` fall-through.
 */
export type RequestWindowError = { problem: RequestWindowProblem; message: string };

/**
 * End-time validator for the human-path window: rejects an end equal to the start, a window that
 * has already elapsed, and a span past the cap the governing rule allows. An end EARLIER than the
 * start is not rejected — it is a window crossing midnight, which `composeRequestWindow` resolves
 * onto the following day. The rules themselves
 * live in `helpers/request-access-window` (`requestWindowProblem`) so they stay Angular-free and
 * unit-testable without a form; this is only the reactive-forms adapter. Stays quiet while the
 * window is incomplete.
 *
 * Field-level rather than group-level so `bit-form-field` renders it in the End time slot, which is
 * what carries the control association, the invalid styling and the live announcement. That slot
 * holds the past-window message too, even though a past DATE is what usually causes it: the date
 * and both times compose into one window, and splitting the verdict across three fields would make
 * the same problem render up to three times.
 *
 * A factory rather than a bare validator because the cap is per-rule and is not known until the
 * pre-check lands. `maxWindowSeconds` is read through a callback rather than captured, so
 * re-opening the fold-out against a different rule does not leave a stale cap behind. `now` is a
 * callback for the same reason — read per run, so a form left open does not keep validating against
 * the instant it was built.
 */
export function requestWindowEndValidator(
  maxWindowSeconds: () => number,
  message: (problem: RequestWindowProblem, maxWindowSeconds: number) => string,
  now: () => Date = () => new Date(),
): (control: AbstractControl) => ValidationErrors | null {
  return (control) => {
    const group = control.parent;
    if (group == null) {
      return null;
    }
    // Read off the sibling CONTROLS, never `group.value`: `updateValueAndValidity` emits the
    // child's `valueChanges` before it propagates to the parent, so inside a sibling's handler the
    // group's cached value snapshot is still the previous one.
    const requested: RequestWindowFormValue = {
      date: group.get("date")?.value,
      start: group.get("start")?.value,
      end: control.value,
    };
    const max = maxWindowSeconds();
    const problem = requestWindowProblem(requested, max, now());
    if (problem == null) {
      return null;
    }
    const error: RequestWindowError = { problem, message: message(problem, max) };
    return { [REQUEST_WINDOW_ERROR_KEY]: error };
  };
}
