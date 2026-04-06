async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Matches whether the received promise has been fulfilled.
 *
 * Failure if the promise is not currently fulfilled.
 *
 * @param received The promise to test
 * @param withinMs The time within the promise should be fulfilled. Defaults to 0, indicating that the promise should already be fulfilled
 * @returns CustomMatcherResult indicating whether or not the test passed
 */
export const toBeFulfilled: jest.CustomMatcher = async function (
  received: Promise<unknown>,
  withinMs = 0,
) {
  return {
    pass: await Promise.race([
      wait(withinMs).then(() => false),
      received.then(
        () => true,
        () => true,
      ),
    ]),
    message: () => `expected promise to be fulfilled`,
  };
};

/**
 * Matches whether the received promise has been resolved.
 *
 * Failure if the promise is not currently fulfilled or if it has been rejected.
 * 
 * @param received The promise to test
 * @param withinMs The time within the promise should be resolved. Defaults to 0, indicating that the promise should already be resolved
 * @returns CustomMatcherResult indicating whether or not the test passed

 */
export const toBeResolved: jest.CustomMatcher = async function (
  received: Promise<unknown>,
  withinMs = 0,
) {
  return {
    pass: await Promise.race([
      wait(withinMs).then(() => false),
      received.then(
        () => true,
        () => false,
      ),
    ]),
    message: () => `expected promise to be resolved`,
  };
};

/**
 * Matches whether the received promise has been rejected.
 *
 * Failure if the promise is not currently fulfilled or if it has been resolved, but not rejected.
 *
 * @param received The promise to test
 * @param withinMs The time within the promise should be rejected. Defaults to 0, indicating that the promise should already be rejected
 * @returns CustomMatcherResult indicating whether or not the test passed
 */
export const toBeRejected: jest.CustomMatcher = async function (
  received: Promise<unknown>,
  withinMs = 0,
) {
  return {
    pass: await Promise.race([
      wait(withinMs).then(() => false),
      received.then(
        () => false,
        () => true,
      ),
    ]),
    message: () => `expected promise to be rejected`,
  };
};
