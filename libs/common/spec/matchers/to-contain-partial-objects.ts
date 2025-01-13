import { diff } from "jest-diff";

export const toContainPartialObjects: jest.CustomMatcher = function (
  received: Array<any>,
  expected: Array<any>,
) {
  const pass = this.equals(
    received,
    expect.arrayContaining(expected.map((e) => expect.objectContaining(e))),
  );

  return {
    message: () => diff(expected, received) as string,
    pass: pass,
  };
};
