import { auditPresetRange, auditRangeEnd, auditRangeStart, toAuditRow } from "./access-audit-row";
import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

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
    expect(result.cipherId).toBeNull();
    expect(result.inDoubt).toBe(false);
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

    const result = toAuditRow(event, new Map([["cipher-1", "prod db"]]), new Map());

    expect(result.cipherId).toBe("cipher-1");
    expect(result.cipherName).toBe("prod db");
  });

  // The id rides on the row whether or not the item decrypted, but the Item cell only links a row that
  // has a name to render as the link text.
  it("carries the subject cipher's id even when the item did not decrypt", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.CredentialAccessed,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      ActorName: "Ada",
      CipherId: "cipher-9",
      Automated: false,
    });

    const result = toAuditRow(event, new Map(), new Map());

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

  // The whole fetched trail, which is the 90-day window the endpoint serves — not all history.
  it("bounds All time on neither side", () => {
    expect(auditPresetRange("allTime", now)).toEqual({ from: null, to: null });
  });

  // Custom takes its bounds from the dialog, never from the clock.
  it("bounds Custom on neither side", () => {
    expect(auditPresetRange("custom", now)).toEqual({ from: null, to: null });
  });
});
