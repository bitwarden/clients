import "core-js/proposals/explicit-resource-management";

import { webcrypto } from "crypto";

import { addCustomMatchers } from "./spec";

Object.defineProperty(window, "crypto", {
  value: webcrypto,
});

// Ensure structuredClone is available in jsdom
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (value: any): any => {
    // Handle primitives and null
    if (value === null || typeof value !== "object") {
      return value;
    }

    // Handle Date objects
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    // Handle Arrays
    if (Array.isArray(value)) {
      return value.map((item) => globalThis.structuredClone(item));
    }

    // Handle objects
    const cloned: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        cloned[key] = globalThis.structuredClone(value[key]);
      }
    }
    return cloned;
  };
}

// Add custom matchers
addCustomMatchers();
