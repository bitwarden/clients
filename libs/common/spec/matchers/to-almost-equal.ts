/**
 * Matches the expected date within an optional ms precision
 * @param received The received date
 * @param expected The expected date
 * @param msPrecision The optional precision in milliseconds
 */
export const toAlmostEqual: jest.CustomMatcher = function (
  received: Date,
  expected: Date,
  msPrecision: number = 10,
) {
  const receivedTime = received.getTime();
  const expectedTime = expected.getTime();
  const difference = Math.abs(receivedTime - expectedTime);
  return {
    pass: difference <= msPrecision,
    message: () =>
      `expected ${received} to be within ${msPrecision}ms of ${expected} (actual difference: ${difference}ms)`,
  };
};
