import { AbstractControl, ValidationErrors } from "@angular/forms";

import { type RequestWindowProblem, requestWindowProblem } from "../helpers/request-access-window";

/** The key the window validator reports under, so the template can branch on the problem. */
export const REQUEST_WINDOW_ERROR_KEY = "requestWindow";

/**
 * The shape reported under {@link REQUEST_WINDOW_ERROR_KEY}. `message` is already localized so
 * `bit-error` renders it through its `error[1].message` fall-through.
 */
export type RequestWindowError = { problem: RequestWindowProblem; message: string };

/**
 * End-time validator for the human-path window: rejects an end at or before the start, and a span
 * past the cap the governing rule allows. The rules themselves live in
 * `helpers/request-access-window` (`requestWindowProblem`) so they stay Angular-free and
 * unit-testable without a form; this is only the reactive-forms adapter. Stays quiet while the
 * window is incomplete.
 *
 * Field-level rather than group-level so `bit-form-field` renders it in the End time slot, which is
 * what carries the control association, the invalid styling and the live announcement.
 *
 * A factory rather than a bare validator because the cap is per-rule and is not known until the
 * pre-check lands. `maxWindowSeconds` is read through a callback rather than captured, so
 * re-opening the fold-out against a different rule does not leave a stale cap behind.
 */
export function requestWindowEndValidator(
  maxWindowSeconds: () => number,
  message: (problem: RequestWindowProblem, maxWindowSeconds: number) => string,
): (control: AbstractControl) => ValidationErrors | null {
  return (control) => {
    const group = control.parent;
    if (group == null) {
      return null;
    }
    // Read off the sibling CONTROLS, never `group.value`: `updateValueAndValidity` emits the
    // child's `valueChanges` before it propagates to the parent, so inside a sibling's handler the
    // group's cached value snapshot is still the previous one.
    const date = group.get("date")?.value as string | null | undefined;
    const start = group.get("start")?.value as string | null | undefined;
    const max = maxWindowSeconds();
    const problem = requestWindowProblem(
      { date, start, end: control.value as string | null | undefined },
      max,
    );
    return problem == null
      ? null
      : { [REQUEST_WINDOW_ERROR_KEY]: { problem, message: message(problem, max) } };
  };
}
