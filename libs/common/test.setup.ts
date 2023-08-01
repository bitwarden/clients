import { webcrypto } from "crypto";

import { toEqualBuffer } from "./spec";

Object.defineProperty(window, "crypto", {
  value: webcrypto,
});

// Add custom matchers

expect.extend({
  toEqualBuffer: toEqualBuffer,
});

interface CustomMatchers<R = unknown> {
  toEqualBuffer(expected: Uint8Array | ArrayBuffer): R;
}

/* eslint-disable */
declare global {
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
    interface BufferMatchers extends Matchers<Uint8Array | ArrayBuffer> {
      toEqualBuffer: (expected: Uint8Array | ArrayBuffer) => CustomMatcherResult;
    }
  }
}
/* eslint-enable */
