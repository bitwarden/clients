import { setupZoneTestEnv } from "jest-preset-angular/setup-env/zone";

setupZoneTestEnv({ errorOnUnknownElements: true, errorOnUnknownProperties: true });

// JSDOM does not implement ResizeObserver, which `bitOverflowList` (and anything
// built on it, such as the table toolbar's filter row) constructs on init. Suites
// that assert on packing install their own observer over this one.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver ??= ResizeObserverStub;
