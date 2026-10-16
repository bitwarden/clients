import { AbstractControl, ValidationErrors } from "@angular/forms";

import {
  type RequestWindowFormValue,
  type RequestWindowProblem,
  requestWindowProblem,
} from "../helpers/request-access-window";

export const REQUEST_WINDOW_ERROR_KEY = "requestWindow";

/**
 * `message` is already localized, so `bit-error` renders it through its `error[1].message`
 * fall-through.
 */
export type RequestWindowError = { problem: RequestWindowProblem; message: string };

/**
 * Field-level rather than group-level, so `bit-form-field` renders it in the End time slot. The cap
 * is a callback, since it is per-rule and unknown until the pre-check lands.
 */
export function requestWindowEndValidator(
  maxWindowSeconds: () => number | null,
  message: (problem: RequestWindowProblem, maxWindowSeconds: number) => string,
  now: () => Date = () => new Date(),
): (control: AbstractControl) => ValidationErrors | null {
  return (control) => {
    const group = control.parent;
    if (group == null) {
      return null;
    }
    // Reads the sibling controls rather than `group.value`, since a child's `valueChanges` fires
    // before the group's cached value updates.
    const requested: RequestWindowFormValue = {
      startDate: group.get("startDate")?.value,
      startTime: group.get("startTime")?.value,
      endDate: group.get("endDate")?.value,
      endTime: control.value,
    };
    const max = maxWindowSeconds();
    // No cap yet means the pre-check has not landed, and no form renders until it has.
    if (max == null) {
      return null;
    }
    const problem = requestWindowProblem(requested, max, now());
    if (problem == null) {
      return null;
    }
    const error: RequestWindowError = { problem, message: message(problem, max) };
    return { [REQUEST_WINDOW_ERROR_KEY]: error };
  };
}
