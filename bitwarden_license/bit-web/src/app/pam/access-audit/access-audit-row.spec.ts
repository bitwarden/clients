import {
  auditPresetRange,
  auditRangeEnd,
  auditRangeStart,
  auditRangeValue,
  toAuditRow,
  withinAuditHistory,
} from "./access-audit-row";
import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

describe("audit range bounds", () => {
  it("writes a local instant back as the datetime-local value it reads from", () => {
    const value = auditRangeValue(new Date(2026, 5, 3, 9, 5, 30));

    expect(value).toBe("2026-06-03T09:05");
    expect(auditRangeStart(value)).toEqual(new Date(2026, 5, 3, 9, 5));
  });

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

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

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

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

    expect(result.ruleName).toBe("prod-rule");
    expect(result.cipherName).toBeNull();
    expect(result.cipherId).toBeNull();
    expect(result.inDoubt).toBe(false);
  });

  it("carries the target system and access connector a fleet event names", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.AccessConnectorAssignedToTarget,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      ActorName: "admin",
      TargetSystemName: "prod-postgres-01",
      AccessConnectorName: "eu-west-rotator",
      Automated: false,
    });

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

    expect(result.targetSystemName).toBe("prod-postgres-01");
    expect(result.accessConnectorName).toBe("eu-west-rotator");
    expect(result.cipherName).toBeNull();
    expect(result.ruleName).toBeNull();
  });

  it("leaves the fleet names null on an event that does not concern the fleet", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.RequestApproved,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      ActorName: "admin",
      Automated: false,
    });

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

    expect(result.targetSystemName).toBeNull();
    expect(result.accessConnectorName).toBeNull();
  });

  it("carries the subject cipher's id beside its decrypted name", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.CredentialAccessed,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      ActorName: "Ada",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      Automated: false,
    });

    const result = toAuditRow(event, new Map([["cipher-1", "prod db"]]), new Map(), "en-US");

    expect(result.cipherId).toBe("cipher-1");
    expect(result.cipherName).toBe("prod db");
  });

  // The Item cell, not the row, withholds the link when the name is missing.
  it("carries the subject cipher's id even when the item did not decrypt", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.CredentialAccessed,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      ActorName: "Ada",
      CipherId: "cipher-9",
      Automated: false,
    });

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

    expect(result.cipherId).toBe("cipher-9");
    expect(result.cipherName).toBeNull();
  });

  it("marks a row in-doubt when the event is incomplete", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.LeaseActivated,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: false,
      Incomplete: true,
    });

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

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

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

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

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

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

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

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

    const result = toAuditRow(event, new Map(), new Map(), "en-US");

    expect(result.duration).toBeNull();
    expect(result.exactWindow).toBeNull();
    expect(result.extendedUntil).toBeNull();
  });
});

describe("auditPresetRange", () => {
  /** Mid-afternoon local time, so "today" and "the last 24 hours" are two different windows. */
  const now = new Date(2026, 7, 18, 15, 30, 45, 123);

  it("starts Today at midnight local, not twenty-four hours back", () => {
    const range = auditPresetRange("today", now);

    expect(range.from).toEqual(new Date(2026, 7, 18, 0, 0, 0, 0));
    expect(range.to).toBeNull();
  });

  it("starts Past 7 days seven days before the moment it is read", () => {
    const range = auditPresetRange("past7Days", now);

    expect(range.from).toEqual(new Date(2026, 7, 11, 15, 30, 45, 123));
    expect(range.to).toBeNull();
  });

  it("starts Past 30 days thirty days before the moment it is read", () => {
    const range = auditPresetRange("past30Days", now);

    expect(range.from).toEqual(new Date(2026, 6, 19, 15, 30, 45, 123));
    expect(range.to).toBeNull();
  });

  it("bounds All time on neither side", () => {
    expect(auditPresetRange("allTime", now)).toEqual({ from: null, to: null });
  });

  // Custom takes its bounds from the dialog, never from the clock.
  it("bounds Custom on neither side", () => {
    expect(auditPresetRange("custom", now)).toEqual({ from: null, to: null });
  });
});

describe("withinAuditHistory", () => {
  const now = new Date(2026, 7, 18, 15, 30, 45, 123);
  const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  it("keeps bounds inside the window", () => {
    const start = new Date(2026, 7, 1, 9, 0);
    const end = new Date(2026, 7, 2, 9, 0);

    expect(withinAuditHistory({ start, end }, now)).toEqual({ start, end });
  });

  it("keeps a start on the window's first instant", () => {
    expect(withinAuditHistory({ start: windowStart }, now).start).toEqual(windowStart);
  });

  it("leaves off a start the window has passed", () => {
    const start = new Date(windowStart.getTime() - 1);

    expect(withinAuditHistory({ start }, now).start).toBeUndefined();
  });

  it("leaves off an end still ahead of now", () => {
    const end = new Date(now.getTime() + 1);

    expect(withinAuditHistory({ end }, now).end).toBeUndefined();
  });

  it("carries the rest of the filter through", () => {
    const filter = { start: windowStart, kinds: ["ruleCreated"], continuationToken: "page-2" };

    expect(withinAuditHistory(filter, now)).toEqual(filter);
  });
});
