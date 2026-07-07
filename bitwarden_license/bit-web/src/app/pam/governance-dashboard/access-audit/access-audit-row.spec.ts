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
    inDoubt: false,
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

  it("resolves the label key for a rotation lifecycle kind", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.RotationSucceeded,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: true,
      TargetSystemId: "ts-1",
      TargetSystemName: "Prod MSSQL",
      RotationConfigId: "cfg-1",
      RotationJobId: "job-1",
      RotationSource: 0,
      SyncState: 1,
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.kindLabelKey).toBe("pamAuditKindRotationSucceeded");
    expect(result.targetSystemName).toBe("Prod MSSQL");
    expect(result.daemonName).toBeNull();
    expect(result.rotationSource).toBe(0);
    expect(result.syncState).toBe(1);
    // targetSystemName is included in the free-text search haystack.
    expect(result.searchText).toContain("prod mssql");
  });

  it("subject falls back to targetSystemName when cipher and rule names are absent", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.RotationPaused,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: false,
      ActorName: "admin",
      TargetSystemName: "Entra Prod",
      RotationConfigId: "cfg-2",
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.cipherName).toBeNull();
    expect(result.ruleName).toBeNull();
    expect(result.targetSystemName).toBe("Entra Prod");
    expect(result.searchText).toContain("entra prod");
  });

  it("subject falls back to daemonName for a daemon fleet event", () => {
    const event = new AccessAuditEventResponse({
      Kind: AccessAuditEventKind.DaemonRegistered,
      OccurredAt: "2026-06-30T12:00:00Z",
      OrganizationId: "org-1",
      Automated: false,
      ActorName: "admin",
      DaemonId: "daemon-1",
      DaemonName: "on-prem-agent-1",
    });

    const result = toAuditRow(event, new Map(), new Map());

    expect(result.kindLabelKey).toBe("pamAuditKindDaemonRegistered");
    expect(result.daemonName).toBe("on-prem-agent-1");
    expect(result.targetSystemName).toBeNull();
    expect(result.searchText).toContain("on-prem-agent-1");
  });

  it("resolves label keys for all 26 rotation event kinds", () => {
    const rotationKinds: Array<[AccessAuditEventKind, string]> = [
      [AccessAuditEventKind.RotationConfigCreated, "pamAuditKindRotationConfigCreated"],
      [AccessAuditEventKind.RotationSettingsUpdated, "pamAuditKindRotationSettingsUpdated"],
      [AccessAuditEventKind.RotationAccountUpdated, "pamAuditKindRotationAccountUpdated"],
      [AccessAuditEventKind.RotationPaused, "pamAuditKindRotationPaused"],
      [AccessAuditEventKind.RotationResumed, "pamAuditKindRotationResumed"],
      [AccessAuditEventKind.RotationConfigDeleted, "pamAuditKindRotationConfigDeleted"],
      [AccessAuditEventKind.RotationOffered, "pamAuditKindRotationOffered"],
      [AccessAuditEventKind.RotationDispatched, "pamAuditKindRotationDispatched"],
      [AccessAuditEventKind.RotationSucceeded, "pamAuditKindRotationSucceeded"],
      [AccessAuditEventKind.RotationAttemptFailed, "pamAuditKindRotationAttemptFailed"],
      [AccessAuditEventKind.RotationFailed, "pamAuditKindRotationFailed"],
      [AccessAuditEventKind.RotationReleased, "pamAuditKindRotationReleased"],
      [AccessAuditEventKind.RotationTimedOut, "pamAuditKindRotationTimedOut"],
      [AccessAuditEventKind.RotationWriteRejected, "pamAuditKindRotationWriteRejected"],
      [AccessAuditEventKind.RotationReportRejected, "pamAuditKindRotationReportRejected"],
      [AccessAuditEventKind.ManualRotationDue, "pamAuditKindManualRotationDue"],
      [AccessAuditEventKind.ManualRotationRecorded, "pamAuditKindManualRotationRecorded"],
      [AccessAuditEventKind.DaemonRegistered, "pamAuditKindDaemonRegistered"],
      [AccessAuditEventKind.DaemonRevoked, "pamAuditKindDaemonRevoked"],
      [AccessAuditEventKind.DaemonAssigned, "pamAuditKindDaemonAssigned"],
      [AccessAuditEventKind.DaemonUnassigned, "pamAuditKindDaemonUnassigned"],
      [AccessAuditEventKind.TargetRegistered, "pamAuditKindTargetRegistered"],
      [AccessAuditEventKind.TargetDisabled, "pamAuditKindTargetDisabled"],
      [AccessAuditEventKind.TargetEnabled, "pamAuditKindTargetEnabled"],
      [AccessAuditEventKind.TargetRenamed, "pamAuditKindTargetRenamed"],
      [AccessAuditEventKind.TargetPolicyUpdated, "pamAuditKindTargetPolicyUpdated"],
    ];

    for (const [kind, expectedKey] of rotationKinds) {
      const event = new AccessAuditEventResponse({
        Kind: kind,
        OccurredAt: "2026-06-30T12:00:00Z",
        OrganizationId: "org-1",
        Automated: true,
      });
      const result = toAuditRow(event, new Map(), new Map());
      expect(result.kindLabelKey).toBe(expectedKey);
    }
  });
});
