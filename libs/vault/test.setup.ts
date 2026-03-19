import { webcrypto } from "crypto";
import "@bitwarden/ui-common/setup-jest";

// Polyfill Request/Response for jsdom environment
if (typeof globalThis.Request === "undefined") {
  globalThis.Request = class Request {
    url: string;

    constructor(
      public input: string | URL,
      public init?: RequestInit,
    ) {
      this.url = typeof input === "string" ? input : input.toString();
    }
  } as any;
}

if (typeof globalThis.Response === "undefined") {
  globalThis.Response = class Response {
    constructor(
      public body?: any,
      public init?: ResponseInit,
    ) {}
  } as any;
}

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
