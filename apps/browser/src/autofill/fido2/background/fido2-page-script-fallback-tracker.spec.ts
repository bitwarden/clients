import { Fido2PageScriptFallbackTracker } from "./fido2-page-script-fallback-tracker";

describe("Fido2PageScriptFallbackTracker", () => {
  let now: number;
  let tracker: Fido2PageScriptFallbackTracker;

  beforeEach(() => {
    now = 1_000_000;
    tracker = new Fido2PageScriptFallbackTracker(() => now);
  });

  it("returns false when nothing is pending for the tab", () => {
    expect(tracker.consumeIfPending(7)).toBe(false);
  });

  it("returns true once after a mark, then false on subsequent calls", () => {
    tracker.markFallbackInProgress(7);
    expect(tracker.consumeIfPending(7)).toBe(true);
    expect(tracker.consumeIfPending(7)).toBe(false);
  });

  it("treats expired markers as absent", () => {
    tracker.markFallbackInProgress(7);
    now += 11_000;
    expect(tracker.consumeIfPending(7)).toBe(false);
  });

  it("tracks each tab independently", () => {
    tracker.markFallbackInProgress(1);
    tracker.markFallbackInProgress(2);
    expect(tracker.consumeIfPending(2)).toBe(true);
    expect(tracker.consumeIfPending(1)).toBe(true);
  });
});
