import { AccessAuditEventKind, AccessAuditEventResponse } from "@bitwarden/bit-pam";

import { AuditRow, auditRowMatchesFilter, toAuditRow } from "./access-audit-row";

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    occurredAt: new Date("2026-06-30T12:00:00Z"),
    kind: AccessAuditEventKind.RequestSubmitted,
    kindLabelKey: "pamAuditKindRequestSubmitted",
    actor: "alice",
    requester: "alice",
    cipherName: "prod db",
    collectionName: "production",
    ruleName: null,
    detail: null,
    automated: false,
    requestId: null,
    searchText: "alice alice prod db production",
    ...overrides,
  };
}

describe("auditRowMatchesFilter", () => {
  it("matches everything when the filter is empty", () => {
    expect(auditRowMatchesFilter(row(), { text: "", kind: null })).toBe(true);
  });

  it("matches free text against the haystack, case-insensitively", () => {
    expect(auditRowMatchesFilter(row(), { text: "PROD", kind: null })).toBe(true);
    expect(auditRowMatchesFilter(row(), { text: "  production ", kind: null })).toBe(true);
    expect(auditRowMatchesFilter(row(), { text: "staging", kind: null })).toBe(false);
  });

  it("filters by event kind", () => {
    const deleted = row({ kind: AccessAuditEventKind.RuleDeleted });
    expect(
      auditRowMatchesFilter(deleted, { text: "", kind: AccessAuditEventKind.RuleDeleted }),
    ).toBe(true);
    expect(
      auditRowMatchesFilter(deleted, { text: "", kind: AccessAuditEventKind.RequestSubmitted }),
    ).toBe(false);
  });

  it("requires both text and kind to match when both are set", () => {
    const revoked = row({ kind: AccessAuditEventKind.LeaseRevoked, searchText: "bob server" });
    expect(
      auditRowMatchesFilter(revoked, { text: "bob", kind: AccessAuditEventKind.LeaseRevoked }),
    ).toBe(true);
    expect(
      auditRowMatchesFilter(revoked, { text: "bob", kind: AccessAuditEventKind.RequestSubmitted }),
    ).toBe(false);
    expect(
      auditRowMatchesFilter(revoked, { text: "carol", kind: AccessAuditEventKind.LeaseRevoked }),
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
  });
});
