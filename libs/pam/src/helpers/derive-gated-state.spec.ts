import { LeaseResponse } from "../abstractions/responses/lease.response";

import { deriveGatedState } from "./derive-gated-state";

function buildLease(overrides: Partial<LeaseResponse> = {}): LeaseResponse {
  return Object.assign(new LeaseResponse({}), {
    id: "lease-1",
    requestId: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    granteeUserId: "user-1",
    notBefore: new Date("2026-01-01T00:00:00Z").toISOString(),
    notAfter: new Date("2026-01-01T01:00:00Z").toISOString(),
    status: "active",
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
    ...overrides,
  });
}

describe("deriveGatedState", () => {
  const userId = "user-1";
  const cipherId = "cipher-1";
  const now = new Date("2026-01-01T00:30:00Z");

  it("returns 'unleased' when memberships list is empty", () => {
    expect(deriveGatedState(cipherId, [], [], userId, now)).toBe("unleased");
  });

  it("returns 'unleased' when any membership has requireLease=false", () => {
    const memberships = [{ requireLease: true }, { requireLease: false }];
    expect(deriveGatedState(cipherId, memberships, [], userId, now)).toBe("unleased");
  });

  it("returns 'gated_active_lease' when every membership requires lease and an active lease covers the caller", () => {
    const memberships = [{ requireLease: true }];
    const leases = [buildLease()];
    expect(deriveGatedState(cipherId, memberships, leases, userId, now)).toBe("gated_active_lease");
  });

  it("returns 'gated_no_lease' when every membership requires lease but no active lease exists", () => {
    const memberships = [{ requireLease: true }];
    expect(deriveGatedState(cipherId, memberships, [], userId, now)).toBe("gated_no_lease");
  });

  it("does not treat an expired lease as active even if status field says active", () => {
    const memberships = [{ requireLease: true }];
    const expired = buildLease({
      notAfter: new Date("2026-01-01T00:15:00Z").toISOString(),
    });
    expect(deriveGatedState(cipherId, memberships, [expired], userId, now)).toBe("gated_no_lease");
  });

  it("ignores leases granted to other users", () => {
    const memberships = [{ requireLease: true }];
    const otherUser = buildLease({ granteeUserId: "user-2" });
    expect(deriveGatedState(cipherId, memberships, [otherUser], userId, now)).toBe(
      "gated_no_lease",
    );
  });

  it("ignores leases for other ciphers", () => {
    const memberships = [{ requireLease: true }];
    const otherCipher = buildLease({ cipherId: "cipher-2" });
    expect(deriveGatedState(cipherId, memberships, [otherCipher], userId, now)).toBe(
      "gated_no_lease",
    );
  });

  it("ignores revoked leases", () => {
    const memberships = [{ requireLease: true }];
    const revoked = buildLease({ status: "revoked" });
    expect(deriveGatedState(cipherId, memberships, [revoked], userId, now)).toBe("gated_no_lease");
  });
});
