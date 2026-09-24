import { isProcessReload } from "./is-process-reload";

describe("isProcessReload", () => {
  const getEntriesByType = performance.getEntriesByType;

  afterEach(() => {
    performance.getEntriesByType = getEntriesByType;
  });

  function mockNavigation(entries: Partial<PerformanceNavigationTiming>[]) {
    // jsdom does not implement navigation timing entries.
    performance.getEntriesByType = jest.fn().mockReturnValue(entries);
  }

  it("is true when the renderer was reloaded, e.g. by lock wiping the process", () => {
    mockNavigation([{ type: "reload" }]);

    expect(isProcessReload()).toBe(true);
  });

  it("is false on a fresh start", () => {
    mockNavigation([{ type: "navigate" }]);

    expect(isProcessReload()).toBe(false);
  });

  it("is false when no navigation entry is recorded", () => {
    mockNavigation([]);

    expect(isProcessReload()).toBe(false);
  });
});
