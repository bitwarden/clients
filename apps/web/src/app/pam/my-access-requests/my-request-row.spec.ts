import { AccessLeaseResponse, AccessRequestDetailsResponse } from "@bitwarden/pam";

import { humanDecision } from "../testing/decision-builders";

import {
  buildMyRequestRows,
  resolveResolver,
  statusBadgeVariant,
  statusLabelKey,
  toLeaseRow,
  toRow,
} from "./my-request-row";

/** Build an AccessRequestDetailsResponse from PascalCase overrides over sensible defaults. */
function request(init: Record<string, unknown>): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: "req",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: "me",
    Status: "activated",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-06-18T10:00:00Z",
    Decisions: [],
    ...init,
  });
}

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
    // No extension summary passed → no extension badge fields.
    expect(row.extendedBySeconds).toBeNull();
    expect(row.extendedUntil).toBeNull();
  });

  it("attaches extension info when the lease was extended", () => {
    const lease = new AccessLeaseResponse({
      Id: "lease-1",
      RequestId: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      GranteeUserId: "me",
      NotBefore: "2026-06-10T10:00:00Z",
      NotAfter: "2026-06-10T12:30:00Z",
      Status: "active",
    });
    const row = toLeaseRow(
      lease,
      { cipherNameById: new Map(), collectionNameById: new Map() },
      { addedSeconds: 1800, latestEndMs: Date.parse("2026-06-10T12:30:00Z") },
    );
    expect(row.extendedBySeconds).toBe(1800);
    expect(row.extendedUntil?.getTime()).toBe(Date.parse("2026-06-10T12:30:00Z"));
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

describe("toRow", () => {
  it("defaults the extension badge fields to null and carries producedLeaseId", () => {
    const row = toRow(request({ Id: "orig-1", ProducedLeaseId: "lease-1" }));
    expect(row.producedLeaseId).toBe("lease-1");
    expect(row.extendedBySeconds).toBeNull();
    expect(row.extendedUntil).toBeNull();
  });
});

describe("buildMyRequestRows", () => {
  const original = request({ Id: "orig-1", Status: "activated", ProducedLeaseId: "lease-1" });
  // The real server records an applied extension as `approved` (auto-approved + applied in place),
  // and mints no lease for it (producedLeaseId stays null). The mock/spec uses `activated`.
  const extension = request({
    Id: "ext-1",
    Status: "approved",
    ExtensionOfLeaseId: "lease-1",
    RequestedTtlSeconds: 7200,
    RequestedNotAfter: "2026-06-20T15:00:00Z",
  });

  it("never renders an extension as its own row", () => {
    const rows = buildMyRequestRows([original, extension]);
    expect(rows.map((r) => r.id)).toEqual(["orig-1"]);
  });

  it("folds a single extension onto its original (added time + new end)", () => {
    const orig = buildMyRequestRows([original, extension]).find((r) => r.id === "orig-1")!;
    expect(orig.extendedBySeconds).toBe(7200);
    expect(orig.extendedUntil?.getTime()).toBe(Date.parse("2026-06-20T15:00:00Z"));
  });

  it("sums multiple extensions and takes the latest end, across approved + activated", () => {
    const rows = buildMyRequestRows([
      original,
      request({
        Id: "ext-1",
        Status: "approved", // server contract
        ExtensionOfLeaseId: "lease-1",
        RequestedTtlSeconds: 3600,
        RequestedNotAfter: "2026-06-20T13:00:00Z",
      }),
      request({
        Id: "ext-2",
        Status: "activated", // mock/spec contract — also counts
        ExtensionOfLeaseId: "lease-1",
        RequestedTtlSeconds: 7200,
        RequestedNotAfter: "2026-06-20T15:00:00Z",
      }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["orig-1"]);
    const orig = rows[0];
    expect(orig.extendedBySeconds).toBe(10800);
    expect(orig.extendedUntil?.getTime()).toBe(Date.parse("2026-06-20T15:00:00Z"));
  });

  it("drops a pending extension and does not badge its original yet", () => {
    const rows = buildMyRequestRows([
      original,
      request({
        Id: "ext-pending",
        Status: "pending",
        ExtensionOfLeaseId: "lease-1",
        RequestedTtlSeconds: 7200,
        RequestedNotAfter: "2026-06-20T15:00:00Z",
      }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["orig-1"]);
    expect(rows[0].extendedBySeconds).toBeNull();
    expect(rows[0].extendedUntil).toBeNull();
  });

  it("leaves a non-extended original's badge fields null", () => {
    const rows = buildMyRequestRows([original]);
    expect(rows[0].extendedBySeconds).toBeNull();
    expect(rows[0].extendedUntil).toBeNull();
  });
});
