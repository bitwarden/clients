import { EOL } from "os";

import { diff } from "jest-diff";

export const toContainPartialObjects: jest.CustomMatcher = function (
  received: Array<any>,
  expected: Array<any>,
) {
  const matched = this.equals(
    received,
    expect.arrayContaining(expected.map((e) => expect.objectContaining(e))),
  );

  if (matched) {
    return {
      message: () =>
        "Expected the received array NOT to include partial matches for all expected objects." +
        EOL +
        diff(expected, received),
      pass: true,
    };
  }

  return {
    message: () =>
      "Expected the received array to contain partial matches for all expected objects." +
      EOL +
      diff(expected, received),
    pass: false,
  };
};
