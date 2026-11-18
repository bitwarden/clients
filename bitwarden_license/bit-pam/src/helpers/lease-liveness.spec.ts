import type { CipherAccessStateView } from "../abstractions/access-lease";

import { liveActiveLease } from "./lease-liveness";

const NOW = Date.parse("2026-01-01T15:00:00.000Z");

function stateWithLease(notAfterMs: number): CipherAccessStateView {
  return {
    cipherId: "cipher-1",
    activeLease: { id: "lease-1", notAfter: new Date(notAfterMs).toISOString() },
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
