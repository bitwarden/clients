import type { CipherAccessStateView } from "../abstractions/access-lease";

import { cipherAccessBadgeState } from "./access-badge-state";

describe("cipherAccessBadgeState", () => {
  const view = (badgeState: CipherAccessStateView["badgeState"]): CipherAccessStateView =>
    ({ badgeState }) as CipherAccessStateView;

  it("returns null when there is no access state", () => {
    expect(cipherAccessBadgeState(null)).toBeNull();
    expect(cipherAccessBadgeState(undefined)).toBeNull();
  });

  it("carries the expiry through on the active variant, parsed as a Date", () => {
    const expiresAt = "2024-01-01T01:00:00.000Z";

    expect(cipherAccessBadgeState(view({ active: { expiresAt } }))).toEqual({
      kind: "active",
      expiresAt: new Date(expiresAt),
    });
  });

  it.each(["ready", "pending", "privileged"] as const)("maps the %s badge", (badge) => {
    expect(cipherAccessBadgeState(view(badge))).toEqual({ kind: badge });
  });

  // Precedence between an active lease, an approved request and a pending one is applied in the
  // SDK (`CipherAccessStateView`'s conversion) and covered by its tests — a badge derived from the
  // ranked field cannot disagree with it, which is the point of reading `badgeState` rather than
  // re-ranking the three here.
});
