import type { CipherAccessStateView } from "../abstractions/access-lease";

import { unactivatedApprovedRequest } from "./unactivated-approved-request";

function state(approvedRequest: unknown): CipherAccessStateView {
  return { approvedRequest } as unknown as CipherAccessStateView;
}

describe("unactivatedApprovedRequest", () => {
  it("returns an approved request that has not minted a lease", () => {
    const approved = { id: "request-1" };

    expect(unactivatedApprovedRequest(state(approved))).toBe(approved);
  });

  it("ignores an approved request that already produced a lease", () => {
    expect(
      unactivatedApprovedRequest(state({ id: "request-1", producedLeaseId: "lease-1" })),
    ).toBeUndefined();
  });

  it("returns undefined without a state or an approved request", () => {
    expect(unactivatedApprovedRequest(null)).toBeUndefined();
    expect(unactivatedApprovedRequest(state(undefined))).toBeUndefined();
  });
});
