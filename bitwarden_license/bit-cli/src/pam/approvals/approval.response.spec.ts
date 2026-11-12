import type { ApprovalRow, ManagedLeaseRow } from "@bitwarden/bit-common/pam/approvals";
import type { PamNames } from "@bitwarden/bit-common/pam/shared";

import { ApprovalRowResponse, ManagedLeaseResponse } from "./approval.response";

const hostile = (label: string) => `${label}\u001b[2K\u001b]0;x\u0007\u202e\r\n`;
const names: PamNames = {
  cipher: () => hostile("cipher"),
  collection: () => hostile("collection"),
  organization: () => hostile("org"),
};
const CONTROLS = /[\p{Cc}\u202e]/u;

describe("approval responses", () => {
  it("strips control characters from every name of an approval row", () => {
    const row = {
      id: "a",
      cipherId: "c",
      collectionId: "col",
      organizationId: "o",
      requesterId: "u",
      status: "pending",
      awaitingActivation: false,
    } as unknown as ApprovalRow;
    const response = new ApprovalRowResponse(row, names);
    expect(response.cipherName).toBe("cipher[2K]0;x");
    expect(response.collectionName).toBe("collection[2K]0;x");
    expect(response.organizationName).toBe("org[2K]0;x");
    expect(JSON.stringify(response)).not.toMatch(CONTROLS);
  });

  it("strips control characters from the names of a managed lease", () => {
    const row = {
      leaseId: "l",
      requestId: "r",
      cipherId: "c",
      collectionId: "col",
      requesterId: "u",
      leaseStatus: "active",
      liveness: "live",
    } as unknown as ManagedLeaseRow;
    const response = new ManagedLeaseResponse(row, names);
    expect(response.cipherName).toBe("cipher[2K]0;x");
    expect(response.collectionName).toBe("collection[2K]0;x");
    expect(JSON.stringify(response)).not.toMatch(CONTROLS);
  });
});
