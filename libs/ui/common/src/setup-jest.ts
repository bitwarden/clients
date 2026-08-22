import { setupZoneTestEnv } from "jest-preset-angular/setup-env/zone";

setupZoneTestEnv({ errorOnUnknownElements: true, errorOnUnknownProperties: true });

// JSDOM has no ResizeObserver, which `bitOverflowList` constructs on init. Suites
// that assert on packing install their own over this one.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver ??= ResizeObserverStub;
