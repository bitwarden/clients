/**
 * How a fill attempt concluded.
 *
 * `Absent` is a fill-failure the request may go on from. `Denied`, `Cancelled` and `Invalid`
 * terminate it, and are read alike. See `autofill.design.md`, "Outcomes".
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
  /**
   * The fill was cancelled before the fill committed, so the attempt never reached the
   * page. The request terminates, and nothing it would have released is released.
   */
  Cancelled: "cancelled",
  /**
   * A runtime check the attempt depends on could not be applied, so the attempt never reached the
   * page: the browser could not say which document a frame holds, no account is active, or the
   * target tab has no URL. The request terminates, and nothing it would have released is released.
   * Each invalid attempt is logged as a warning.
   */
  Invalid: "invalid",
} as const);
export type AutofillOutcome = (typeof AutofillOutcome)[keyof typeof AutofillOutcome];
