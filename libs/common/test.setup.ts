import { webcrypto } from "crypto";

import { addCustomMatchers } from "./spec";

Object.defineProperty(window, "crypto", {
  value: webcrypto,
});

// Add custom matchers
addCustomMatchers();
