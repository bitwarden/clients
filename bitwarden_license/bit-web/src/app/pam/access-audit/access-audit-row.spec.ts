import { AuditRow, auditRowMatchesFilter, toAuditRow } from "./access-audit-row";
import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    occurredAt: new Date("2026-06-30T12:00:00Z"),
    kindLabelKey: "pamAuditKindRequestSubmitted",
    actor: "alice",
    requester: "alice",
    cipherName: "prod db",
    collectionName: "production",
    ruleName: null,
    detail: null,
    automated: false,
    inDoubt: false,
    requestId: null,
    duration: null,
    durationWindow: null,
    extendedUntil: null,
    searchText: "alice alice prod db production",
    ...overrides,
  };
}

describe("auditRowMatchesFilter", () => {
  it("matches everything when the filter is empty", () => {
    expect(auditRowMatchesFilter(row(), { text: "", kindLabelKey: null })).toBe(true);
  });

  it("matches free text against the haystack, case-insensitively", () => {
    expect(auditRowMatchesFilter(row(), { text: "PROD", kindLabelKey: null })).toBe(true);
    expect(auditRowMatchesFilter(row(), { text: "  production ", kindLabelKey: null })).toBe(true);
    expect(auditRowMatchesFilter(row(), { text: "staging", kindLabelKey: null })).toBe(false);
  });

  it("filters by event-kind label key", () => {
    const deleted = row({ kindLabelKey: "pamAuditKindRuleDeleted" });
    expect(
      auditRowMatchesFilter(deleted, { text: "", kindLabelKey: "pamAuditKindRuleDeleted" }),
    ).toBe(true);
    expect(
      auditRowMatchesFilter(deleted, { text: "", kindLabelKey: "pamAuditKindRequestSubmitted" }),
    ).toBe(false);
  });

  it("requires both text and kind to match when both are set", () => {
    const revoked = row({ kindLabelKey: "pamAuditKindLeaseRevoked", searchText: "bob server" });
    expect(
      auditRowMatchesFilter(revoked, { text: "bob", kindLabelKey: "pamAuditKindLeaseRevoked" }),
    ).toBe(true);
    expect(
      auditRowMatchesFilter(revoked, {
        text: "bob",
        kindLabelKey: "pamAuditKindRequestSubmitted",
      }),
    ).toBe(false);
    expect(
      auditRowMatchesFilter(revoked, { text: "carol", kindLabelKey: "pamAuditKindLeaseRevoked" }),
    ).toBe(false);
  });
});

describe("toAuditRow", () => {
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
    // A rule event has no cipher, so the item falls back to the rule name.
    expect(result.cipherName).toBeNull();
    // The rule name is part of the free-text search haystack.
    expect(result.searchText).toContain("prod-rule");
    // A completed event (no Incomplete flag) is not in-doubt.
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
    expect(result.durationWindow).toEqual(expect.stringContaining("–"));
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
    expect(result.durationWindow).toBeNull();
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
    expect(result.durationWindow).toBeNull();
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
    expect(result.durationWindow).toBeNull();
    expect(result.extendedUntil).toBeNull();
  });
});
