import type { AccessLeaseView, CipherAccessStateView } from "@bitwarden/sdk-internal";

import { isLeaseLive, liveActiveLease } from "./live-active-lease";

const NOW = Date.parse("2026-03-01T12:00:00Z");

function lease(notAfter: string): AccessLeaseView {
  return { notAfter } as unknown as AccessLeaseView;
}

function state(activeLease?: AccessLeaseView): CipherAccessStateView {
  return { activeLease, badgeState: "Leased" } as unknown as CipherAccessStateView;
}

describe("isLeaseLive", () => {
  it("is true while the window is open", () => {
    expect(isLeaseLive(lease("2026-03-01T12:00:01Z"), NOW)).toBe(true);
  });

  it("is false at the instant it closes", () => {
    expect(isLeaseLive(lease("2026-03-01T12:00:00Z"), NOW)).toBe(false);
  });

  it("fails closed on an unparseable date", () => {
    expect(isLeaseLive(lease("not a date"), NOW)).toBe(false);
    expect(isLeaseLive(lease(""), NOW)).toBe(false);
  });
});

describe("liveActiveLease", () => {
  it("returns the lease while it is live", () => {
    const active = lease("2026-03-01T13:00:00Z");

    expect(liveActiveLease(state(active), NOW)).toBe(active);
  });

  it("returns undefined once the lease has lapsed", () => {
    expect(liveActiveLease(state(lease("2026-03-01T11:00:00Z")), NOW)).toBeUndefined();
  });

  it("returns undefined with no lease or no state", () => {
    expect(liveActiveLease(state(undefined), NOW)).toBeUndefined();
    expect(liveActiveLease(null, NOW)).toBeUndefined();
    expect(liveActiveLease(undefined, NOW)).toBeUndefined();
  });
});
