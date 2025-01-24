/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */

const { clearImmediate, setImmediate } = require("node:timers");

Object.defineProperties(globalThis, {
  clearImmediate: { value: clearImmediate },
  setImmediate: { value: setImmediate },
});
