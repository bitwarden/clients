import { webcrypto } from "crypto";

import { addCustomMatchers } from "@bitwarden/common/spec";
import "@bitwarden/ui-common/setup-jest";

// jsdom does not expose Symbol.dispose / Symbol.asyncDispose, but TypeScript's compiled
// output for `using` declarations requires them. Polyfill here so specs that test code
// using explicit resource management (`using ref = sdk.take()`) work correctly.
if (!Symbol.dispose) {
  Object.defineProperty(Symbol, "dispose", { value: Symbol("Symbol.dispose") });
}
if (!Symbol.asyncDispose) {
  Object.defineProperty(Symbol, "asyncDispose", { value: Symbol("Symbol.asyncDispose") });
}

addCustomMatchers();

Object.defineProperty(window, "CSS", { value: null });
Object.defineProperty(window, "getComputedStyle", {
  value: () => {
    return {
      display: "none",
      appearance: ["-webkit-appearance"],
    };
  },
});

Object.defineProperty(document, "doctype", {
  value: "<!DOCTYPE html>",
});
Object.defineProperty(document.body.style, "transform", {
  value: () => {
    return {
      enumerable: true,
      configurable: true,
    };
  },
});

Object.defineProperty(window, "crypto", {
  value: webcrypto,
});
