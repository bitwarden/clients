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

  describe("requester and reason", () => {
    const baseRow = {
      id: "a",
      cipherId: "c",
      collectionId: "col",
      requesterId: "u",
      status: "pending",
      awaitingActivation: false,
    };

    it("carries the requester and reason, sanitized", () => {
      const row = {
        ...baseRow,
        requesterName: hostile("Ada"),
        requesterEmail: hostile("ada@example.com"),
        reason: hostile("need it"),
      } as unknown as ApprovalRow;
      const response = new ApprovalRowResponse(row);
      expect(response.requesterName).toBe("Ada[2K]0;x");
      expect(response.requesterEmail).toBe("ada@example.com[2K]0;x");
      expect(response.reason).toBe("need it[2K]0;x");
      expect(JSON.stringify(response)).not.toMatch(CONTROLS);
    });

    it("caps the name and email at 200 and the reason at 1000 characters", () => {
      const row = {
        ...baseRow,
        requesterName: "n".repeat(500),
        requesterEmail: "e".repeat(500),
        reason: "r".repeat(5000),
      } as unknown as ApprovalRow;
      const response = new ApprovalRowResponse(row);
      expect(Array.from(response.requesterName!)).toHaveLength(200);
      expect(Array.from(response.requesterEmail!)).toHaveLength(200);
      expect(Array.from(response.reason!)).toHaveLength(1000);
    });

    it("omits the fields when the row has none", () => {
      const json = JSON.parse(JSON.stringify(new ApprovalRowResponse(baseRow as ApprovalRow)));
      expect(json).not.toHaveProperty("requesterName");
      expect(json).not.toHaveProperty("requesterEmail");
      expect(json).not.toHaveProperty("reason");
    });

    it("omits a field that sanitizes to nothing", () => {
      const row = { ...baseRow, reason: "\u202e\u001b" } as unknown as ApprovalRow;
      expect(new ApprovalRowResponse(row).reason).toBeUndefined();
    });
  });
});
