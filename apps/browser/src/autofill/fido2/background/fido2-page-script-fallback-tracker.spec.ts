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

  it("prunes expired markers on each write so the map stays bounded when nothing consumes", () => {
    tracker.markFallbackInProgress(1);
    tracker.markFallbackInProgress(2);

    now += 11_000;
    tracker.markFallbackInProgress(3);
    // Tabs 1 and 2 were expired and pruned on tab 3's write; only tab 3 remains.
    expect(tracker.consumeIfPending(1)).toBe(false);
    expect(tracker.consumeIfPending(2)).toBe(false);
    expect(tracker.consumeIfPending(3)).toBe(true);
  });
});
