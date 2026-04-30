"use strict";

// Minimal jsdom mock for node test environments.
// The CLI service-container uses new JSDOM().window.DOMParser to polyfill the global DOMParser.
class JSDOM {
  constructor() {
    this.window = {
      DOMParser: class DOMParser {
        parseFromString() {
          return {};
        }
      },
    };
  }
}

module.exports = { JSDOM };
