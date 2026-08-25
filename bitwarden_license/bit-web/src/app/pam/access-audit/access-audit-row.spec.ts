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
});
