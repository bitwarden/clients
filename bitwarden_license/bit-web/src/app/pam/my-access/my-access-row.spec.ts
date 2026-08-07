import type {
  AccessLeaseView,
  AccessRequestDecisionView,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { emptyResolvedNames, ResolvedNames } from "./access-name-resolver.service";
import {
  buildMyAccessRequestRows,
  extensionsByLeaseId,
  historyDisplayStatus,
  resolveResolver,
  statusBadgeVariant,
  statusLabelKey,
  toLeaseRow,
  toRequestRow,
} from "./my-access-row";

// Overrides are loosely typed (not `Partial<AccessRequestView>`): the SDK's id/cipherId/collectionId
// fields are opaque branded types, so tests stand in plain strings and rely on the final
// `as unknown as` cast, matching the convention in the sibling SDK specs.
function request(id: string, overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id,
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    ruleId: undefined,
    status: "pending",
    leaseNotBefore: "2024-01-01T00:00:00.000Z",
    leaseNotAfter: "2024-01-01T01:00:00.000Z",
    reason: undefined,
    submittedAt: "2024-01-01T00:00:00.000Z",
    resolvedAt: undefined,
    decisions: [],
    producedLeaseId: undefined,
    producedLeaseStatus: undefined,
    extensionOfLeaseId: undefined,
    requesterName: undefined,
    requesterEmail: undefined,
    ...overrides,
  } as unknown as AccessRequestView;
}

function decision(overrides: Record<string, unknown> = {}): AccessRequestDecisionView {
  return {
    deciderKind: "automatic",
    id: undefined,
    name: undefined,
    email: undefined,
    comment: undefined,
    verdict: "approve",
    decidedAt: "2024-01-01T00:15:00.000Z",
    ...overrides,
  } as unknown as AccessRequestDecisionView;
}

function lease(id: string, overrides: Record<string, unknown> = {}): AccessLeaseView {
  return {
    id,
    requestId: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "active",
    notBefore: "2024-01-01T00:00:00.000Z",
    notAfter: "2024-01-01T01:00:00.000Z",
    revokedAt: undefined,
    revokedByUserId: undefined,
    ...overrides,
  } as unknown as AccessLeaseView;
}

function names(overrides: Partial<ResolvedNames> = {}): ResolvedNames {
  return { ...emptyResolvedNames(), ...overrides };
}

describe("statusLabelKey / statusBadgeVariant", () => {
  it.each([
    ["pending", "pamStatusPending", "primary"],
    ["approved", "pamStatusApproved", "success"],
    ["activated", "pamStatusActivated", "success"],
    ["denied", "pamStatusDenied", "danger"],
    ["canceled", "pamStatusCanceled", "subtle"],
    ["expired", "pamStatusExpired", "warning"],
    ["unknown", "pamStatusUnknown", "subtle"],
  ] as const)("maps %s to %s / %s", (status, labelKey, variant) => {
    expect(statusLabelKey(status)).toBe(labelKey);
    expect(statusBadgeVariant(status)).toBe(variant);
  });
});

describe("historyDisplayStatus", () => {
  it("labels a still-active produced lease as Activated/success", () => {
    const r = request("req-1", {
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "active",
    });
    expect(historyDisplayStatus(r)).toEqual({
      statusLabelKey: "pamStatusActivated",
      statusVariant: "success",
    });
  });

  it("labels a revoked lease ended by the holder as Cancelled (pamStatusEndedByYou)", () => {
    const r = request("req-1", {
      status: "activated",
      requesterId: "user-1",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "revoked",
      decisions: [decision({ deciderKind: "human", id: "user-1", verdict: "deny" })],
    });
    expect(historyDisplayStatus(r)).toEqual({
      statusLabelKey: "pamStatusEndedByYou",
      statusVariant: "subtle",
    });
  });

  it("labels a revoked lease ended by someone else as Revoked", () => {
    const r = request("req-1", {
      status: "activated",
      requesterId: "user-1",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "revoked",
      decisions: [decision({ deciderKind: "human", id: "operator-1", verdict: "deny" })],
    });
    expect(historyDisplayStatus(r)).toEqual({
      statusLabelKey: "pamStatusRevoked",
      statusVariant: "subtle",
    });
  });

  it("labels a revoked lease with no human decision as Revoked (defensive default)", () => {
    const r = request("req-1", {
      status: "activated",
      requesterId: "user-1",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "revoked",
      decisions: [],
    });
    expect(historyDisplayStatus(r)).toEqual({
      statusLabelKey: "pamStatusRevoked",
      statusVariant: "subtle",
    });
  });

  it("defaults an activated request's lapsed/expired lease to Expired", () => {
    const r = request("req-1", {
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "expired",
    });
    expect(historyDisplayStatus(r)).toEqual({
      statusLabelKey: "pamStatusExpired",
      statusVariant: "warning",
    });
  });

  it("falls back to the base status mapping for non-activated requests", () => {
    const r = request("req-1", { status: "denied" });
    expect(historyDisplayStatus(r)).toEqual({
      statusLabelKey: "pamStatusDenied",
      statusVariant: "danger",
    });
  });
});

describe("resolveResolver", () => {
  it("returns blank for a pending request", () => {
    expect(resolveResolver("pending", undefined)).toEqual({
      resolverLabelKey: null,
      resolverName: null,
    });
  });

  it("returns the access-rule label when there is no human decision", () => {
    expect(resolveResolver("activated", undefined)).toEqual({
      resolverLabelKey: "pamResolverAccessRule",
      resolverName: null,
    });
  });

  it("returns the human decider's name", () => {
    const human = decision({ deciderKind: "human", name: "Jane Doe", email: "jane@example.com" });
    expect(resolveResolver("denied", human)).toEqual({
      resolverLabelKey: null,
      resolverName: "Jane Doe",
    });
  });

  it("falls back to email, then id, when the name is unresolved", () => {
    const byEmail = decision({ deciderKind: "human", name: undefined, email: "jane@example.com" });
    expect(resolveResolver("denied", byEmail).resolverName).toBe("jane@example.com");

    const byId = decision({
      deciderKind: "human",
      name: undefined,
      email: undefined,
      id: "user-9",
    });
    expect(resolveResolver("denied", byId).resolverName).toBe("user-9");
  });
});

describe("toRequestRow", () => {
  it("resolves cipher/collection names when known", () => {
    const n = names({
      cipherNameById: new Map([["cipher-1", "Prod DB"]]),
      collectionNameById: new Map([["col-1", "Infra"]]),
    });

    const row = toRequestRow(request("req-1"), n);

    expect(row.cipherName).toBe("Prod DB");
    expect(row.collectionName).toBe("Infra");
    expect(row.statusLabelKey).toBe("pamStatusPending");
    expect(row.statusVariant).toBe("primary");
    expect(row.id).toBe("req-1");
  });

  it("falls back to null when a name is unresolved", () => {
    const row = toRequestRow(request("req-1"), emptyResolvedNames());

    expect(row.cipherName).toBeNull();
    expect(row.collectionName).toBeNull();
    expect(row.cipherId).toBe("cipher-1");
    expect(row.collectionId).toBe("col-1");
  });

  it("carries reason/submittedAt/resolvedAt/producedLeaseId through", () => {
    const row = toRequestRow(
      request("req-1", { resolvedAt: "2024-01-01T00:30:00.000Z", producedLeaseId: "lease-1" }),
      emptyResolvedNames(),
    );

    expect(row.submittedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(row.resolvedAt).toBe("2024-01-01T00:30:00.000Z");
    expect(row.producedLeaseId).toBe("lease-1");
  });

  it("reads the resolver + comment from the human decision", () => {
    const row = toRequestRow(
      request("req-1", {
        status: "denied",
        decisions: [decision({ deciderKind: "human", name: "Jane Doe", comment: "Not now" })],
      }),
      emptyResolvedNames(),
    );

    expect(row.resolverName).toBe("Jane Doe");
    expect(row.approverComment).toBe("Not now");
  });
});

describe("extensionsByLeaseId", () => {
  it("sums approved/activated extensions keyed by the parent lease id", () => {
    const requests = [
      request("ext-1", {
        extensionOfLeaseId: "lease-1",
        status: "approved",
        leaseNotBefore: "2024-01-01T01:00:00.000Z",
        leaseNotAfter: "2024-01-01T02:00:00.000Z",
      }),
      request("ext-2", {
        extensionOfLeaseId: "lease-1",
        status: "activated",
        leaseNotBefore: "2024-01-01T02:00:00.000Z",
        leaseNotAfter: "2024-01-01T03:30:00.000Z",
      }),
    ];

    const byLease = extensionsByLeaseId(requests);

    expect(byLease.get("lease-1")).toEqual({
      addedSeconds: 3600 + 5400,
      latestEndMs: Date.parse("2024-01-01T03:30:00.000Z"),
    });
  });

  it("skips non-extension requests and pending/denied/canceled extensions", () => {
    const requests = [
      request("req-1"), // not an extension at all
      request("ext-1", { extensionOfLeaseId: "lease-1", status: "pending" }),
      request("ext-2", { extensionOfLeaseId: "lease-1", status: "denied" }),
      request("ext-3", { extensionOfLeaseId: "lease-1", status: "canceled" }),
    ];

    expect(extensionsByLeaseId(requests).size).toBe(0);
  });
});

describe("buildMyAccessRequestRows", () => {
  it("drops extension requests and folds their added time onto the original row", () => {
    const original = request("req-1", {
      status: "activated",
      producedLeaseId: "lease-1",
    });
    const extension = request("ext-1", {
      extensionOfLeaseId: "lease-1",
      status: "activated",
      leaseNotBefore: "2024-01-01T01:00:00.000Z",
      leaseNotAfter: "2024-01-01T03:00:00.000Z",
    });

    const rows = buildMyAccessRequestRows([original, extension], emptyResolvedNames());

    expect(rows.map((r) => r.id)).toEqual(["req-1"]);
    expect(rows[0].extendedBySeconds).toBe(7200);
    expect(rows[0].extendedUntil).toBe(
      new Date(Date.parse("2024-01-01T03:00:00.000Z")).toISOString(),
    );
  });

  it("leaves extendedBySeconds/extendedUntil null when there is no extension", () => {
    const rows = buildMyAccessRequestRows([request("req-1")], emptyResolvedNames());

    expect(rows[0].extendedBySeconds).toBeNull();
    expect(rows[0].extendedUntil).toBeNull();
  });
});

describe("toLeaseRow", () => {
  it("resolves names and carries the originating request link", () => {
    const n = names({ cipherNameById: new Map([["cipher-1", "Prod DB"]]) });

    const row = toLeaseRow(lease("lease-1"), n);

    expect(row.cipherName).toBe("Prod DB");
    expect(row.collectionName).toBeNull();
    expect(row.requestId).toBe("req-1");
    expect(row.extendedBySeconds).toBeNull();
  });

  it("badges the row when an extension summary is supplied", () => {
    const row = toLeaseRow(lease("lease-1"), emptyResolvedNames(), {
      addedSeconds: 1800,
      latestEndMs: Date.parse("2024-01-01T02:00:00.000Z"),
    });

    expect(row.extendedBySeconds).toBe(1800);
    expect(row.extendedUntil).toBe(new Date(Date.parse("2024-01-01T02:00:00.000Z")).toISOString());
  });

  it("falls back to the raw id when a name is unresolved", () => {
    const row = toLeaseRow(lease("lease-1"), emptyResolvedNames());

    expect(row.cipherName).toBeNull();
    expect(row.collectionName).toBeNull();
    expect(row.cipherId).toBe("cipher-1");
  });
});
