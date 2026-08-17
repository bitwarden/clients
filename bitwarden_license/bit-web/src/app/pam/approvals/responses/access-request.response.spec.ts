import {
  AccessRequestDecisionResponse,
  AccessRequestDetailsResponse,
  toAccessDecisionVerdict,
  toAccessLeaseStatus,
  toAccessRequestStatus,
} from "./access-request.response";

describe("toAccessRequestStatus", () => {
  it.each([
    ["pending", "pending"],
    ["approved", "approved"],
    ["activated", "activated"],
    ["denied", "denied"],
    ["expired", "expired"],
  ])("passes %s through", (wire, expected) => {
    expect(toAccessRequestStatus(wire)).toBe(expected);
  });

  it.each(["canceled", "cancelled"])("normalises %s onto the SDK's one-L spelling", (wire) => {
    expect(toAccessRequestStatus(wire)).toBe("canceled");
  });

  it("is case-insensitive", () => {
    expect(toAccessRequestStatus("Pending")).toBe("pending");
  });

  it.each([["something-new"], [null], [undefined], [42]])(
    "maps %s to unknown rather than guessing",
    (wire) => {
      expect(toAccessRequestStatus(wire)).toBe("unknown");
    },
  );
});

describe("toAccessLeaseStatus", () => {
  it("is undefined when the server sent nothing", () => {
    expect(toAccessLeaseStatus(null)).toBeUndefined();
    expect(toAccessLeaseStatus(undefined)).toBeUndefined();
  });

  it.each([
    ["active", "active"],
    ["expired", "expired"],
    ["revoked", "revoked"],
  ])("passes %s through", (wire, expected) => {
    expect(toAccessLeaseStatus(wire)).toBe(expected);
  });

  it.each(["cancelled", "canceled"])("collapses %s onto revoked", (wire) => {
    // The SDK has no `cancelled` lease status; a holder ending their own lease and an operator
    // revoking it are told apart from the decision log instead.
    expect(toAccessLeaseStatus(wire)).toBe("revoked");
  });

  it("maps an unrecognised value to unknown", () => {
    expect(toAccessLeaseStatus("brand-new")).toBe("unknown");
  });
});

describe("toAccessDecisionVerdict", () => {
  it.each([
    [0, "deny"],
    ["0", "deny"],
    [1, "approve"],
    ["1", "approve"],
    ["deny", "deny"],
    ["approve", "approve"],
    ["Approve", "approve"],
  ])("maps %s to %s", (wire, expected) => {
    expect(toAccessDecisionVerdict(wire)).toBe(expected);
  });

  it("maps an unrecognised value to unknown", () => {
    expect(toAccessDecisionVerdict("maybe")).toBe("unknown");
  });
});

describe("AccessRequestDecisionResponse", () => {
  it("maps a human decision onto the SDK's tagged decider", () => {
    const decision = new AccessRequestDecisionResponse({
      DeciderKind: "human",
      Id: "approver-1",
      Name: "Ada",
      Email: "ada@example.com",
      Comment: "looks fine",
      Verdict: 1,
      DecidedAt: "2026-08-17T10:00:00.000Z",
    });

    expect(decision.decider).toEqual({
      human: { id: "approver-1", name: "Ada", email: "ada@example.com" },
    });
    expect(decision.verdict).toBe("approve");
    expect(decision.comment).toBe("looks fine");
    expect(decision.decidedAt).toBe("2026-08-17T10:00:00.000Z");
  });

  it("maps an automatic decision to the bare `automatic` decider", () => {
    const decision = new AccessRequestDecisionResponse({
      DeciderKind: "automatic",
      Verdict: 1,
      DecidedAt: "2026-08-17T10:00:00.000Z",
    });

    expect(decision.decider).toBe("automatic");
  });

  it("leaves an unresolvable approver's fields undefined rather than null", () => {
    // The SDK view uses `undefined` for absent; nulls would leak into `name || email || id` chains.
    const decision = new AccessRequestDecisionResponse({
      DeciderKind: "human",
      Id: null,
      Name: null,
      Email: null,
      Comment: null,
      Verdict: 0,
      DecidedAt: "2026-08-17T10:00:00.000Z",
    });

    expect(decision.decider).toEqual({
      human: { id: undefined, name: undefined, email: undefined },
    });
    expect(decision.comment).toBeUndefined();
  });
});

describe("AccessRequestDetailsResponse", () => {
  const wire = {
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    OrganizationId: "org-1",
    RequesterId: "user-1",
    RuleId: "rule-1",
    Status: "pending",
    LeaseNotBefore: "2026-08-17T12:00:00.000Z",
    LeaseNotAfter: "2026-08-17T13:00:00.000Z",
    Reason: "prod incident",
    SubmittedAt: "2026-08-17T11:00:00.000Z",
    ResolvedAt: null as string | null,
    ExpiredAt: null as string | null,
    Decisions: [] as unknown[],
    ProducedLeaseId: null as string | null,
    ProducedLeaseStatus: null as string | null,
    ExtensionOfLeaseId: null as string | null,
    RequesterName: "Grace",
    RequesterEmail: "grace@example.com",
  };

  it("mirrors the SDK view field for field", () => {
    const response = new AccessRequestDetailsResponse(wire);

    expect(response.id).toBe("req-1");
    expect(response.cipherId).toBe("cipher-1");
    expect(response.collectionId).toBe("col-1");
    expect(response.organizationId).toBe("org-1");
    expect(response.requesterId).toBe("user-1");
    expect(response.ruleId).toBe("rule-1");
    expect(response.status).toBe("pending");
    expect(response.leaseNotBefore).toBe("2026-08-17T12:00:00.000Z");
    expect(response.leaseNotAfter).toBe("2026-08-17T13:00:00.000Z");
    expect(response.reason).toBe("prod incident");
    expect(response.submittedAt).toBe("2026-08-17T11:00:00.000Z");
    expect(response.requesterName).toBe("Grace");
    expect(response.requesterEmail).toBe("grace@example.com");
  });

  it("turns the wire's nulls into undefined, matching the SDK view", () => {
    const response = new AccessRequestDetailsResponse(wire);

    expect(response.resolvedAt).toBeUndefined();
    expect(response.expiredAt).toBeUndefined();
    expect(response.producedLeaseId).toBeUndefined();
    expect(response.producedLeaseStatus).toBeUndefined();
    expect(response.extensionOfLeaseId).toBeUndefined();
  });

  it("reads camelCase as well as PascalCase", () => {
    // BaseResponse tries both cases; a server that ever camelCases must not silently blank a row.
    const response = new AccessRequestDetailsResponse({
      id: "req-2",
      cipherId: "cipher-2",
      collectionId: "col-2",
      requesterId: "user-2",
      status: "approved",
      submittedAt: "2026-08-17T11:00:00.000Z",
      leaseNotBefore: "2026-08-17T12:00:00.000Z",
      leaseNotAfter: "2026-08-17T13:00:00.000Z",
    });

    expect(response.id).toBe("req-2");
    expect(response.status).toBe("approved");
  });

  it("falls back to the submit time when the window is missing, so the row reads as lapsed", () => {
    // Safer than inventing a window: a zero-length one drops out of the actionable inbox rather than
    // offering a decision that could grant nothing.
    const response = new AccessRequestDetailsResponse({
      ...wire,
      LeaseNotBefore: null,
      LeaseNotAfter: null,
    });

    expect(response.leaseNotBefore).toBe(wire.SubmittedAt);
    expect(response.leaseNotAfter).toBe(wire.SubmittedAt);
  });

  it("builds the decision log oldest-first as SDK views", () => {
    const response = new AccessRequestDetailsResponse({
      ...wire,
      Status: "approved",
      Decisions: [
        { DeciderKind: "automatic", Verdict: 1, DecidedAt: "2026-08-17T11:30:00.000Z" },
        {
          DeciderKind: "human",
          Id: "approver-1",
          Name: "Ada",
          Verdict: 1,
          DecidedAt: "2026-08-17T11:45:00.000Z",
        },
      ],
    });

    expect(response.decisions).toHaveLength(2);
    expect(response.decisions[0].decider).toBe("automatic");
    expect(response.decisions[1].decider).toEqual({
      human: { id: "approver-1", name: "Ada", email: undefined },
    });
  });

  it("treats an absent decision log as empty rather than undefined", () => {
    const response = new AccessRequestDetailsResponse({ ...wire, Decisions: null });

    expect(response.decisions).toEqual([]);
  });

  it("normalises the produced lease's cancelled status onto revoked", () => {
    const response = new AccessRequestDetailsResponse({
      ...wire,
      ProducedLeaseId: "lease-1",
      ProducedLeaseStatus: "cancelled",
    });

    expect(response.producedLeaseStatus).toBe("revoked");
  });
});
