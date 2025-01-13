import { EOL } from "os";

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
    message: () =>
      "Received array did not contain partial matches for all expected objects." +
      EOL +
      diff(expected, received),
    pass: pass,
  };
};
