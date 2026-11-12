import { Observable, of, Subject } from "rxjs";

import type { CipherAccessStateView } from "../abstractions/access-lease";

import { liveActiveLease, nextRereadMs, rereadOnLapse } from "./lease-liveness";

const NOW = Date.parse("2026-01-01T15:00:00.000Z");

function stateWithLease(notAfterMs: number): CipherAccessStateView {
  return {
    cipherId: "cipher-1",
    activeLease: { id: "lease-1", notAfter: new Date(notAfterMs).toISOString() },
  } as unknown as CipherAccessStateView;
}

function stateWithRequest(
  kind: "pendingRequest" | "approvedRequest",
  leaseNotAfterMs: number,
): CipherAccessStateView {
  return {
    cipherId: "cipher-1",
    [kind]: { id: "request-1", leaseNotAfter: new Date(leaseNotAfterMs).toISOString() },
  } as unknown as CipherAccessStateView;
}

function restingState(): CipherAccessStateView {
  return { cipherId: "cipher-1", badgeState: "privileged" } as unknown as CipherAccessStateView;
}

describe("liveActiveLease", () => {
  it("returns the lease while its window is open", () => {
    const state = stateWithLease(NOW + 1_000);

    expect(liveActiveLease(state, NOW)).toBe(state.activeLease);
  });

  it("returns undefined once the window has closed", () => {
    expect(liveActiveLease(stateWithLease(NOW), NOW)).toBeUndefined();
    expect(liveActiveLease(stateWithLease(NOW - 1), NOW)).toBeUndefined();
  });

  it("returns undefined when there is no lease at all", () => {
    expect(liveActiveLease(restingState(), NOW)).toBeUndefined();
    expect(liveActiveLease(null, NOW)).toBeUndefined();
    expect(liveActiveLease(undefined, NOW)).toBeUndefined();
  });

  it("fails closed on an expiry it cannot parse", () => {
    const state = {
      activeLease: { id: "lease-1", notAfter: "not a date" },
    } as unknown as CipherAccessStateView;

    expect(liveActiveLease(state, NOW)).toBeUndefined();
  });
});

/** Each thing in a state that lapses without anything announcing it. */
const lapsingStates: [string, (endMs: number) => CipherAccessStateView][] = [
  ["a live lease", stateWithLease],
  ["a pending request's window", (endMs) => stateWithRequest("pendingRequest", endMs)],
  ["an approved request's window", (endMs) => stateWithRequest("approvedRequest", endMs)],
];

describe("nextRereadMs", () => {
  it.each(lapsingStates)("returns the end of %s", (_, stateEndingAt) => {
    expect(nextRereadMs(stateEndingAt(NOW + 2_000), NOW)).toBe(NOW + 2_000);
  });

  it("returns the earliest end when several are pending", () => {
    const state = {
      ...stateWithLease(NOW + 5_000),
      approvedRequest: { leaseNotAfter: new Date(NOW + 3_000).toISOString() },
    } as unknown as CipherAccessStateView;

    expect(nextRereadMs(state, NOW)).toBe(NOW + 3_000);
  });

  it("asks again shortly about a request window just closed, for a server whose clock trails", () => {
    expect(nextRereadMs(stateWithRequest("pendingRequest", NOW), NOW)).toBe(NOW + 5_000);
    expect(nextRereadMs(stateWithRequest("pendingRequest", NOW - 59_000), NOW)).toBe(NOW + 5_000);
  });

  it("does not ask again about a lease already ended, which liveActiveLease clamps locally", () => {
    expect(nextRereadMs(stateWithLease(NOW), NOW)).toBeUndefined();
  });

  it("gives up on a window long closed and ignores one it cannot parse", () => {
    expect(nextRereadMs(stateWithRequest("pendingRequest", NOW - 60_000), NOW)).toBeUndefined();
    expect(
      nextRereadMs(
        { pendingRequest: { leaseNotAfter: "not a date" } } as unknown as CipherAccessStateView,
        NOW,
      ),
    ).toBeUndefined();
  });

  it("returns undefined when nothing lapses", () => {
    expect(nextRereadMs(restingState(), NOW)).toBeUndefined();
    expect(nextRereadMs(null, NOW)).toBeUndefined();
  });
});

describe("rereadOnLapse", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(lapsingStates)("reads again once %s ends", (_, stateEndingAt) => {
    const ticks$ = new Subject<number>();
    const read$ = jest
      .fn<Observable<CipherAccessStateView>, []>()
      .mockReturnValueOnce(of(stateEndingAt(NOW + 1_000)))
      .mockReturnValueOnce(of(restingState()));
    const emitted: CipherAccessStateView[] = [];
    rereadOnLapse(read$, ticks$).subscribe((state) => emitted.push(state));

    ticks$.next(NOW + 999);
    expect(read$).toHaveBeenCalledTimes(1);

    ticks$.next(NOW + 1_000);
    expect(read$).toHaveBeenCalledTimes(2);
    expect(emitted.at(-1)).toEqual(restingState());
  });

  it("keeps asking for a bounded time while a trailing server still reports the closed window", () => {
    const ticks$ = new Subject<number>();
    const stale = stateWithRequest("pendingRequest", NOW + 1_000);
    const read$ = jest.fn().mockReturnValue(of(stale));
    rereadOnLapse(read$, ticks$).subscribe();
    const tickAt = (ms: number) => {
      jest.setSystemTime(ms);
      ticks$.next(ms);
    };

    tickAt(NOW + 1_000);
    expect(read$).toHaveBeenCalledTimes(2);

    // The server still reports the window, so it asks again five seconds on, not every tick.
    tickAt(NOW + 3_000);
    expect(read$).toHaveBeenCalledTimes(2);
    tickAt(NOW + 6_000);
    expect(read$).toHaveBeenCalledTimes(3);

    // A minute past the end it stops asking, so a stuck server cannot keep it reading.
    for (let ms = NOW + 7_000; ms <= NOW + 120_000; ms += 1_000) {
      tickAt(ms);
    }
    expect(read$).toHaveBeenCalledTimes(14);
  });

  it("does not read again when nothing in the state lapses", () => {
    const ticks$ = new Subject<number>();
    const read$ = jest.fn().mockReturnValue(of(restingState()));
    rereadOnLapse(read$, ticks$).subscribe();

    ticks$.next(NOW + 60_000);

    expect(read$).toHaveBeenCalledTimes(1);
  });
});
