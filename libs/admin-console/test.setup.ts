import { webcrypto } from "crypto";

import { addCustomMatchers } from "@bitwarden/common/spec";
import "@bitwarden/ui-common/setup-jest";

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
