import {
  AUTOMATED_ACTOR,
  AuditFilter,
  AuditRow,
  auditRangeEnd,
  auditRangeStart,
  auditRowMatchesFilter,
  toAuditRow,
} from "./access-audit-row";
import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    occurredAt: new Date("2026-06-30T12:00:00Z"),
    kindLabelKey: "pamAuditKindRequestSubmitted",
    actor: "alice",
    actorId: "user-alice",
    actorEmail: "alice@example.com",
    requester: "alice",
    requesterId: "user-alice",
    requesterEmail: "alice@example.com",
    cipherName: "prod db",
    collectionName: "production",
    ruleName: null,
    detail: null,
    automated: false,
    inDoubt: false,
    requestId: null,
    duration: null,
    exactWindow: null,
    extendedUntil: null,
    ...overrides,
  };
}

describe("auditRowMatchesFilter", () => {
  const unfiltered: AuditFilter = { kindLabelKey: null };

  it("matches everything when the filter is empty", () => {
    expect(auditRowMatchesFilter(row(), { kindLabelKey: null })).toBe(true);
  });

  it("filters by event-kind label key", () => {
    const deleted = row({ kindLabelKey: "pamAuditKindRuleDeleted" });
    expect(auditRowMatchesFilter(deleted, { kindLabelKey: "pamAuditKindRuleDeleted" })).toBe(true);
    expect(auditRowMatchesFilter(deleted, { kindLabelKey: "pamAuditKindRequestSubmitted" })).toBe(
      false,
    );
  });

  it("filters by actor identity, not by the name the cell renders", () => {
    const namesake = row({ actor: "J. Smith", actorId: "user-2" });

    expect(auditRowMatchesFilter(namesake, { ...unfiltered, actorId: "user-2" })).toBe(true);
    expect(auditRowMatchesFilter(namesake, { ...unfiltered, actorId: "user-alice" })).toBe(false);
  });

  it("filters by requester identity", () => {
    const forBob = row({ requester: "bob", requesterId: "user-bob" });

    expect(auditRowMatchesFilter(forBob, { ...unfiltered, requesterId: "user-bob" })).toBe(true);
    expect(auditRowMatchesFilter(forBob, { ...unfiltered, requesterId: "user-alice" })).toBe(false);
  });

  it("puts automated rows in their own actor bucket, and only those", () => {
    const automated = row({ actor: null, actorId: null, automated: true });

    expect(auditRowMatchesFilter(automated, { ...unfiltered, actorId: AUTOMATED_ACTOR })).toBe(
      true,
    );
    expect(auditRowMatchesFilter(row(), { ...unfiltered, actorId: AUTOMATED_ACTOR })).toBe(false);
    expect(auditRowMatchesFilter(automated, { ...unfiltered, actorId: "user-alice" })).toBe(false);
  });

  it("keeps an automated row out of a human bucket even when the wire carried an actor id", () => {
    const automated = row({ actorId: "user-alice", automated: true });

    expect(auditRowMatchesFilter(automated, { ...unfiltered, actorId: "user-alice" })).toBe(false);
  });

  it("bounds the range inclusively at both ends", () => {
    const at12 = row({ occurredAt: new Date("2026-06-30T12:00:00Z") });

    expect(
      auditRowMatchesFilter(at12, { ...unfiltered, from: new Date("2026-06-30T12:00:00Z") }),
    ).toBe(true);
    expect(
      auditRowMatchesFilter(at12, { ...unfiltered, to: new Date("2026-06-30T12:00:00Z") }),
    ).toBe(true);
    expect(
      auditRowMatchesFilter(at12, { ...unfiltered, from: new Date("2026-06-30T12:00:00.001Z") }),
    ).toBe(false);
    expect(
      auditRowMatchesFilter(at12, { ...unfiltered, to: new Date("2026-06-30T11:59:59.999Z") }),
    ).toBe(false);
  });

  it("matches nothing when the range is inverted", () => {
    expect(
      auditRowMatchesFilter(row(), {
        ...unfiltered,
        from: new Date("2026-06-30T13:00:00Z"),
        to: new Date("2026-06-30T11:00:00Z"),
      }),
    ).toBe(false);
  });

  it("requires every dimension to match when all of them are set", () => {
    const target = row({
      kindLabelKey: "pamAuditKindLeaseRevoked",
      actorId: "user-ada",
      requesterId: "user-bob",
      occurredAt: new Date("2026-06-30T12:00:00Z"),
    });
    const all = {
      kindLabelKey: "pamAuditKindLeaseRevoked",
      actorId: "user-ada",
      requesterId: "user-bob",
      from: new Date("2026-06-30T11:00:00Z"),
      to: new Date("2026-06-30T13:00:00Z"),
    };

    expect(auditRowMatchesFilter(target, all)).toBe(true);
    expect(auditRowMatchesFilter(target, { ...all, actorId: "user-alice" })).toBe(false);
    expect(auditRowMatchesFilter(target, { ...all, requesterId: "user-alice" })).toBe(false);
    expect(auditRowMatchesFilter(target, { ...all, from: new Date("2026-06-30T12:30:00Z") })).toBe(
      false,
    );
  });
});

describe("audit range bounds", () => {
  it("reads a datetime-local value in the viewer's own zone", () => {
    const start = auditRangeStart("2026-06-30T09:00");

    expect(start).toEqual(new Date(2026, 5, 30, 9, 0));
  });

  it("carries the end bound to the end of its minute, as the Time column's rendering implies", () => {
    const end = auditRangeEnd("2026-06-30T09:00");

    expect(end).toEqual(new Date(2026, 5, 30, 9, 0, 59, 999));
  });

  it("leaves a blank or unparseable bound unbounded", () => {
    expect(auditRangeStart("")).toBeNull();
    expect(auditRangeEnd("")).toBeNull();
    expect(auditRangeStart("not a date")).toBeNull();
  });
});

describe("toAuditRow", () => {
  it("carries the actor and requester identities the chips filter on", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.RequestApproved,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      ActorId: "user-ada",
      ActorName: "Ada",
      ActorEmail: "ada@example.com",
      RequesterId: "user-bob",
      RequesterEmail: "bob@example.com",
      Automated: false,
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.actorId).toBe("user-ada");
    expect(result.actorEmail).toBe("ada@example.com");
    expect(result.requesterId).toBe("user-bob");
    expect(result.requesterEmail).toBe("bob@example.com");
    expect(result.requester).toBe("bob@example.com");
  });

  it("shows the rule name as the item for a rule administration event", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.RuleCreated,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      ActorName: "admin",
      RuleName: "prod-rule",
      Automated: false,
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.ruleName).toBe("prod-rule");
    expect(result.cipherName).toBeNull();
    expect(result.inDoubt).toBe(false);
  });

  it("marks a row in-doubt when the event is incomplete", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.LeaseActivated,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: false,
      Incomplete: true,
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.inDoubt).toBe(true);
  });

  it("states the granted window as a duration on a lease activation", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.LeaseActivated,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: false,
      LeaseNotBefore: "2026-06-30T12:00:00Z",
      LeaseNotAfter: "2026-06-30T13:00:00Z",
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.duration).toEqual({ key: "pamInboxDuration1Hour", value: null });
    expect(result.exactWindow).toContain("–");
    expect(result.extendedUntil).toBeNull();
  });

  it("states no duration on a revoke, whose granted end is not when access ended", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.LeaseRevoked,
      OccurredAt: "2026-06-30T12:05:00Z",
      OrganizationId: "org-1",
      Automated: false,
      LeaseNotBefore: "2026-06-30T12:00:00Z",
      LeaseNotAfter: "2026-06-30T16:00:00Z",
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.duration).toBeNull();
    expect(result.exactWindow).toBeNull();
    expect(result.extendedUntil).toBeNull();
  });

  it("states an extension's new end, the only bound the server writes for that kind", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.LeaseExtended,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: false,
      LeaseNotAfter: "2026-06-30T16:00:00Z",
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.extendedUntil).toBe("2026-06-30T16:00:00Z");
    expect(result.duration).toBeNull();
    expect(result.exactWindow).toBeNull();
  });

  it("states no duration when an activation is missing its start bound", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.LeaseActivated,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: false,
      LeaseNotAfter: "2026-06-30T16:00:00Z",
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.duration).toBeNull();
    expect(result.exactWindow).toBeNull();
    expect(result.extendedUntil).toBeNull();
  });
});
