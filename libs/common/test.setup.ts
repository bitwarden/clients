import { webcrypto } from "crypto";

import { toEqualBuffer } from "./spec";
import { toAlmostEqual } from "./spec/matchers/to-almost-equal";

Object.defineProperty(window, "crypto", {
  value: webcrypto,
});

// Add custom matchers

expect.extend({
  toEqualBuffer: toEqualBuffer,
  toAlmostEqual: toAlmostEqual,
});

export interface CustomMatchers<R = unknown> {
  toEqualBuffer(expected: Uint8Array | ArrayBuffer): R;
  /**
   * Matches the expected date within an optional ms precision
   * @param expected The expected date
   * @param msPrecision The optional precision in milliseconds
   */
  toAlmostEqual(expected: Date, msPrecision?: number): R;
}
