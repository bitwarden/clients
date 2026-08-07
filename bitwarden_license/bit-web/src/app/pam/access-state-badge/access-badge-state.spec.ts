import type { CipherAccessStateView } from "../abstractions/access-lease";

import { cipherAccessBadgeState } from "./access-badge-state";

describe("cipherAccessBadgeState", () => {
  const view = (over: Partial<CipherAccessStateView>): CipherAccessStateView =>
    ({
      activeLease: undefined,
      pendingRequest: undefined,
      approvedRequest: undefined,
      ...over,
    }) as CipherAccessStateView;

  it("returns null when there is no access state", () => {
    expect(cipherAccessBadgeState(null)).toBeNull();
    expect(cipherAccessBadgeState(undefined)).toBeNull();
  });

  it("resolves an active lease to the active state carrying its expiry", () => {
    const notAfter = "2024-01-01T01:00:00.000Z";

    expect(cipherAccessBadgeState(view({ activeLease: { notAfter } as never }))).toEqual({
      kind: "active",
      expiresAt: new Date(notAfter),
    });
  });

  it("ranks an active lease above an approved and a pending request", () => {
    const state = cipherAccessBadgeState(
      view({
        activeLease: { notAfter: "2024-01-01T01:00:00.000Z" } as never,
        approvedRequest: {} as never,
        pendingRequest: {} as never,
      }),
    );

    expect(state?.kind).toBe("active");
  });

  it("ranks an approved request (ready) above a pending one", () => {
    expect(
      cipherAccessBadgeState(view({ approvedRequest: {} as never, pendingRequest: {} as never }))
        ?.kind,
    ).toBe("ready");
  });

  it("resolves a pending request to the pending state", () => {
    expect(cipherAccessBadgeState(view({ pendingRequest: {} as never }))?.kind).toBe("pending");
  });

  it("falls back to privileged for a gated item with no request or lease in play", () => {
    expect(cipherAccessBadgeState(view({}))?.kind).toBe("privileged");
  });
});
