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
 * End-time validator for the human-path window: rejects an end equal to the start, an elapsed
 * window, and a span past the rule's cap. An end EARLIER than the start is a midnight-crossing
 * window instead, resolved by `composeRequestWindow`.
 *
 * Field-level, not group-level, so `bit-form-field` renders it in the End time slot, which
 * also carries the past-window message.
 *
 * A factory, since the cap is per-rule and unknown until the pre-check lands;
 * `maxWindowSeconds` and `now` are callbacks, not captured values.
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
    // Read off sibling CONTROLS, never `group.value`: a child's `valueChanges` fires before the
    // group's cached value updates.
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
