/**
 * How a fill attempt concluded.
 *
 * `Absent` and `Denied` are both forms of fill-failure; what separates them is whether the request
 * may go on. See `autofill.design.md`, "Outcomes".
 */
export const AutofillOutcome = Object.freeze({
  /** A credential reached the page and was placed. */
  Filled: "filled",
  /**
   * The fill placed nothing, and nothing refused it. An ordinary result — a page may simply carry
   * no field the cipher fits. The caller may mitigate the failure rather than abandon the request.
   */
  Absent: "absent",
  /**
   * A fill invariant did not hold, so the attempt never reached the page: a navigation invalidated
   * the request, a policy control disallowed it, or a security check failed. The request
   * terminates, and nothing it would have released is released.
   */
  Denied: "denied",
} as const);
export type AutofillOutcome = (typeof AutofillOutcome)[keyof typeof AutofillOutcome];
