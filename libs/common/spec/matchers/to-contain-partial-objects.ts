import { diff } from "jest-diff";

export const toContainPartialObjects: jest.CustomMatcher = function <T>(
  received: Array<T>,
  expected: Array<T>,
) {
  const pass = this.equals(
    received,
    expect.arrayContaining(expected.map((e) => expect.objectContaining(e))),
  );

  return {
    message: () => diff(expected, received),
    pass: pass,
  };
};
