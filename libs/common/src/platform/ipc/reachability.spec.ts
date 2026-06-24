import { Endpoint } from "@bitwarden/sdk-internal";

import {
  ACTIVE_PING_INTERVAL_MS,
  ACTIVE_WINDOW_MS,
  INACTIVE_PING_INTERVAL_MS,
  isReachabilityPing,
  isReachabilityPong,
  ReachabilityTracker,
} from "./reachability";

describe("ReachabilityTracker", () => {
  let now: number;
  let tracker: ReachabilityTracker;

  const extension: Endpoint = { BrowserBackground: { id: "Own" } };

  beforeEach(() => {
    now = 1_000_000;
    tracker = new ReachabilityTracker(() => now);
  });

  it("is inactive for an endpoint that has never been seen", () => {
    expect(tracker.isActive(extension)).toBe(false);
  });

  it("is active immediately after recording a message", () => {
    tracker.record(extension);
    expect(tracker.isActive(extension)).toBe(true);
  });

  it("stays active just inside the window and goes inactive past it", () => {
    tracker.record(extension);

    now += ACTIVE_WINDOW_MS - 1;
    expect(tracker.isActive(extension)).toBe(true);

    now += 1; // exactly at the window boundary
    expect(tracker.isActive(extension)).toBe(false);
  });

  it("uses the active cadence while active and backs off while inactive", () => {
    expect(tracker.intervalFor(extension)).toBe(INACTIVE_PING_INTERVAL_MS);

    tracker.record(extension);
    expect(tracker.intervalFor(extension)).toBe(ACTIVE_PING_INTERVAL_MS);

    now += ACTIVE_WINDOW_MS;
    expect(tracker.intervalFor(extension)).toBe(INACTIVE_PING_INTERVAL_MS);
  });

  it("collapses desktop main/renderer into a single reachability bucket", () => {
    tracker.record("DesktopMain");
    expect(tracker.isActive("DesktopRenderer")).toBe(true);
  });

  it("tracks web tabs independently by tab id", () => {
    tracker.record({ Web: { tab_id: 1, document_id: "a" } });
    expect(tracker.isActive({ Web: { tab_id: 1, document_id: "a" } })).toBe(true);
    expect(tracker.isActive({ Web: { tab_id: 2, document_id: "b" } })).toBe(false);
  });
});

describe("ReachabilityTracker active/stale transitions", () => {
  let now: number;
  let changes: Array<{ active: boolean }>;
  let tracker: ReachabilityTracker;

  const extension: Endpoint = { BrowserBackground: { id: "Own" } };

  beforeEach(() => {
    now = 1_000_000;
    changes = [];
    tracker = new ReachabilityTracker(
      () => now,
      (_endpoint, active) => changes.push({ active }),
    );
  });

  it("does not report a transition before the endpoint is ever seen", () => {
    tracker.intervalFor(extension); // polled while never-seen
    expect(changes).toEqual([]);
  });

  it("reports active immediately on the first recorded message", () => {
    tracker.record(extension);
    expect(changes).toEqual([{ active: true }]);
  });

  it("reports stale once the window elapses and is polled", () => {
    tracker.record(extension);
    changes.length = 0;

    now += ACTIVE_WINDOW_MS;
    tracker.intervalFor(extension); // poll detects staleness
    expect(changes).toEqual([{ active: false }]);
  });

  it("does not report duplicate transitions while state is unchanged", () => {
    tracker.record(extension);
    tracker.record(extension);
    tracker.intervalFor(extension);
    expect(changes).toEqual([{ active: true }]);
  });

  it("invalidate immediately marks an active endpoint stale and fires the callback", () => {
    tracker.record(extension);
    changes.length = 0;

    tracker.invalidate(extension);
    expect(tracker.isActive(extension)).toBe(false);
    expect(changes).toEqual([{ active: false }]);
  });

  it("invalidate on a never-seen endpoint does not fire the callback", () => {
    tracker.invalidate(extension);
    expect(changes).toEqual([]);
  });
});

describe("reachability message guards", () => {
  it("identifies pings and pongs", () => {
    expect(isReachabilityPing({ type: "bitwarden-reachability-ping" })).toBe(true);
    expect(isReachabilityPong({ type: "bitwarden-reachability-pong" })).toBe(true);
  });

  it("rejects unrelated messages", () => {
    expect(isReachabilityPing({ type: "bitwarden-reachability-pong" })).toBe(false);
    expect(isReachabilityPong({ type: "bitwarden-ipc-message" })).toBe(false);
    expect(isReachabilityPing(undefined)).toBe(false);
    expect(isReachabilityPong(null)).toBe(false);
  });
});
