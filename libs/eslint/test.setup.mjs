/* eslint-disable no-undef */

import { clearImmediate, setImmediate } from "node:timers";

Object.defineProperties(globalThis, {
  clearImmediate: { value: clearImmediate },
  setImmediate: { value: setImmediate },
});
