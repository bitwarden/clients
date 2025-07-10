/**
 * The inbuilt toEqual() matcher will always return TRUE when provided with 2 ArrayBuffers.
 * This is because an ArrayBuffer must be wrapped in a new Uint8Array to be accessible.
 * This custom matcher will automatically instantiate a new Uint8Array on the received value
 * (and optionally, the expected value) and then call toEqual() on the resulting Uint8Arrays.
 */
export const toEqualBuffer: jest.CustomMatcher = function (
  received: ArrayBuffer | Uint8Array,
  expected: ArrayBuffer | Uint8Array,
) {
  received = new Uint8Array(received);
  expected = new Uint8Array(expected);

  if (this.equals(received, expected)) {
    return {
      message: () => `expected
${received}
not to match
${expected}`,
      pass: true,
    };
  }

  return {
    message: () => `expected
${received}
to match
${expected}`,
    pass: false,
  };
};
