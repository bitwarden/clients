import { AbstractControl, ValidationErrors } from "@angular/forms";

import { requestWindowProblem } from "../helpers/request-access-window";

/** The key the window validators report under, so the template can branch on the problem. */
export const REQUEST_WINDOW_ERROR_KEY = "requestWindow";

/**
 * Group-level validator for the human-path window: rejects an end at or before the start, and a
 * span past the server's 24h cap. The rules themselves live in `helpers/request-access-window`
 * (`requestWindowProblem`) so they stay Angular-free and unit-testable without a form; this is
 * only the reactive-forms adapter. Stays quiet while the window is incomplete.
 */
export function requestWindowValidator(control: AbstractControl): ValidationErrors | null {
  const { date, start, end } = control.value as {
    date?: string | null;
    start?: string | null;
    end?: string | null;
  };
  const problem = requestWindowProblem({ date, start, end });
  return problem == null ? null : { [REQUEST_WINDOW_ERROR_KEY]: problem };
}
