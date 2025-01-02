import * as matchers from "jest-extended";

import { toBeFulfilled, toBeResolved, toBeRejected } from "./promise-fulfilled";
import { toAlmostEqual } from "./to-almost-equal";

// add all jest-extended matchers
expect.extend(matchers);

export function addCustomMatchers() {
  expect.extend({
    toAlmostEqual: toAlmostEqual,
    toBeFulfilled: toBeFulfilled,
    toBeResolved: toBeResolved,
    toBeRejected: toBeRejected,
  });
}

export interface CustomMatchers<R = unknown> {
  /**
   * Matches the expected date within an optional ms precision
   * @param expected The expected date
   * @param msPrecision The optional precision in milliseconds
   */
  toAlmostEqual(expected: Date, msPrecision?: number): R;
  /**
   * Matches whether the received promise has been fulfilled.
   *
   * Failure if the promise is not currently fulfilled.
   *
   * @param received The promise to test
   * @param withinMs The time within the promise should be fulfilled. Defaults to 0, indicating that the promise should already be fulfilled
   * @returns CustomMatcherResult indicating whether or not the test passed
   */
  toBeFulfilled(withinMs?: number): Promise<R>;
  /**
   * Matches whether the received promise has been resolved.
   *
   * Failure if the promise is not currently fulfilled or if it has been rejected.
   *
   * @param received The promise to test
   * @param withinMs The time within the promise should be resolved. Defaults to 0, indicating that the promise should already be resolved
   * @returns CustomMatcherResult indicating whether or not the test passed
   */
  toBeResolved(withinMs?: number): Promise<R>;
  /**
   * Matches whether the received promise has been rejected.
   *
   * Failure if the promise is not currently fulfilled or if it has been resolved, but not rejected.
   *
   * @param received The promise to test
   * @param withinMs The time within the promise should be rejected. Defaults to 0, indicating that the promise should already be rejected
   * @returns CustomMatcherResult indicating whether or not the test passed
   */
  toBeRejected(withinMs?: number): Promise<R>;
}
