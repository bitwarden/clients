import { AccessLeaseResponse } from "@bitwarden/pam";

import { humanDecision } from "../testing/decision-builders";

import { resolveResolver, statusBadgeVariant, statusLabelKey, toLeaseRow } from "./my-request-row";

describe("statusBadgeVariant", () => {
  it("maps each status to a distinct visual variant", () => {
    expect(statusBadgeVariant("approved")).toBe("success");
    expect(statusBadgeVariant("activated")).toBe("success");
    expect(statusBadgeVariant("denied")).toBe("danger");
    expect(statusBadgeVariant("cancelled")).toBe("subtle");
    expect(statusBadgeVariant("expired")).toBe("warning");
    expect(statusBadgeVariant("pending")).toBe("primary");
  });
});

describe("statusLabelKey", () => {
  it("returns a pamStatus* i18n key for each status", () => {
    expect(statusLabelKey("approved")).toBe("pamStatusApproved");
    expect(statusLabelKey("activated")).toBe("pamStatusActivated");
    expect(statusLabelKey("denied")).toBe("pamStatusDenied");
    expect(statusLabelKey("cancelled")).toBe("pamStatusCancelled");
    expect(statusLabelKey("expired")).toBe("pamStatusExpired");
    expect(statusLabelKey("pending")).toBe("pamStatusPending");
  });
});

describe("resolveResolver", () => {
  it("returns no resolver for pending requests", () => {
    expect(resolveResolver("pending", undefined)).toEqual({
      resolverLabelKey: null,
      resolverName: null,
    });
  });

  it("returns the access-rule label key when no human resolved the request", () => {
    expect(resolveResolver("expired", undefined)).toEqual({
      resolverLabelKey: "pamResolverAccessRule",
      resolverName: null,
    });
  });

  it("shows the approver name when a human resolved the request", () => {
    expect(
      resolveResolver(
        "approved",
        humanDecision({ id: "user-7", name: "Ada Approver", email: "ada@example.com" }),
      ),
    ).toEqual({
      resolverLabelKey: null,
      resolverName: "Ada Approver",
    });
  });

  it("falls back to the approver email when the name is absent", () => {
    expect(
      resolveResolver(
        "denied",
        humanDecision({ id: "user-7", name: null, email: "ada@example.com" }),
      ),
    ).toEqual({
      resolverLabelKey: null,
      resolverName: "ada@example.com",
    });
  });

  it("falls back to the raw user id when the server could not resolve the user", () => {
    expect(
      resolveResolver("approved", humanDecision({ id: "user-7", name: null, email: null })),
    ).toEqual({
      resolverLabelKey: null,
      resolverName: "user-7",
    });
  });
});

describe("toLeaseRow", () => {
  it("resolves names from the lookup maps and parses the window", () => {
    const lease = new AccessLeaseResponse({
      Id: "lease-1",
      RequestId: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      GranteeUserId: "me",
      NotBefore: "2026-06-10T10:00:00Z",
      NotAfter: "2026-06-10T12:00:00Z",
      Status: "active",
    });
    const row = toLeaseRow(lease, {
      cipherNameById: new Map([["cipher-1", "Prod DB"]]),
      collectionNameById: new Map([["col-1", "Production"]]),
    });
    expect(row.cipherName).toBe("Prod DB");
    expect(row.collectionName).toBe("Production");
    expect(row.notAfter.getTime()).toBe(Date.parse("2026-06-10T12:00:00Z"));
  });

  it("leaves names null when absent from vault state", () => {
    const lease = new AccessLeaseResponse({
      Id: "lease-2",
      RequestId: "req-2",
      CipherId: "cipher-x",
      CollectionId: "col-x",
      GranteeUserId: "me",
      NotBefore: "2026-06-10T10:00:00Z",
      NotAfter: "2026-06-10T12:00:00Z",
      Status: "active",
    });
    const row = toLeaseRow(lease, {
      cipherNameById: new Map(),
      collectionNameById: new Map(),
    });
    expect(row.cipherName).toBeNull();
    expect(row.collectionName).toBeNull();
  });
});
