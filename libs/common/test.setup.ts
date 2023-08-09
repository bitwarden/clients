import { webcrypto } from "crypto";

import { toEqualBuffer } from "./spec";

Object.defineProperty(window, "crypto", {
  value: webcrypto,
});

// Add custom matchers

expect.extend({
  toEqualBuffer: toEqualBuffer,
});

export interface CustomMatchers<R = unknown> {
  toEqualBuffer(expected: Uint8Array | ArrayBuffer): R;
}
