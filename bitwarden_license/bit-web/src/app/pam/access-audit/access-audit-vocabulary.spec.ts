// Without `esModuleInterop`, a default import of JSON doesn't resolve to the whole document.
import * as messages from "@bitwarden/web-vault/locales/en/messages.json";

import { UNEMITTED_AUDIT_KINDS, auditKindLabelKey } from "./access-audit-row";
import { AccessAuditEventKind } from "./responses/access-audit-event.response";

/** Mirrors the server's `AccessAuditEventKindNames`, which defines the wire vocabulary. */
describe("access-audit event vocabulary", () => {
  const localeMessages = messages as Record<string, { message: string } | undefined>;
  const kinds = Object.values(AccessAuditEventKind);

  it("declares exactly the kinds the server can report", () => {
    expect([...kinds].sort()).toEqual(
      [
        "requestSubmitted",
        "requestApproved",
        "requestDenied",
        "requestCancelled",
        "requestExpiredUnanswered",
        "requestExpiredUnactivated",
        "leaseActivated",
        "leaseActivationRejected",
        "leaseExtended",
        "leaseRevoked",
        "leaseExpired",
        "credentialAccessed",
        "credentialAccessDenied",
        "ruleCreated",
        "ruleUpdated",
        "ruleDeleted",
        "leasingKillSwitchTriggered",
        "leasingFreezeEnabled",
        "leasingFreezeLifted",
        "rotationConfigCreated",
        "rotationSettingsUpdated",
        "rotationAccountUpdated",
        "rotationPaused",
        "rotationResumed",
        "rotationConfigDeleted",
        "rotationOffered",
        "rotationDispatched",
        "rotationSucceeded",
        "rotationAttemptFailed",
        "rotationFailed",
        "rotationJobReleased",
        "rotationJobTimedOut",
        "rotationCipherWriteRejected",
        "rotationReportRejected",
        "manualRotationDue",
        "manualRotationRecorded",
        "accessConnectorRegistered",
        "accessConnectorRevoked",
        "accessConnectorDisabled",
        "accessConnectorEnabled",
        "accessConnectorDeleted",
        "accessConnectorAssignedToTarget",
        "accessConnectorUnassignedFromTarget",
        "targetSystemRegistered",
        "targetSystemDisabled",
        "targetSystemEnabled",
        "targetSystemRenamed",
        "targetSystemPolicyUpdated",
        "targetSystemDeleted",
      ].sort(),
    );
  });

  it.each(kinds)("labels %s with copy that ships", (kind) => {
    const key = auditKindLabelKey(kind);

    expect(key).not.toBe("pamAuditKindUnknown");
    expect(localeMessages[key]?.message).toBeTruthy();
  });

  /**
   * Pins the sentences as well as the keys. The locales lint rejects editing a message in place, so
   * rewording mints a new id and the label map can be left reading the old one.
   */
  it.each([
    [AccessAuditEventKind.RotationOffered, "Rotation offered to access connector"],
    [AccessAuditEventKind.AccessConnectorRegistered, "Access connector registered"],
    [AccessAuditEventKind.AccessConnectorRevoked, "Access connector revoked"],
    [AccessAuditEventKind.AccessConnectorDisabled, "Access connector deactivated"],
    [AccessAuditEventKind.AccessConnectorEnabled, "Access connector activated"],
    [AccessAuditEventKind.AccessConnectorDeleted, "Access connector deleted"],
    [AccessAuditEventKind.AccessConnectorAssignedToTarget, "Access connector assigned to target"],
    [
      AccessAuditEventKind.AccessConnectorUnassignedFromTarget,
      "Access connector unassigned from target",
    ],
    [AccessAuditEventKind.TargetSystemDisabled, "Target system deactivated"],
    [AccessAuditEventKind.TargetSystemEnabled, "Target system activated"],
  ])("renders %s as its renamed copy, not the daemon-era wording", (kind, sentence) => {
    expect(localeMessages[auditKindLabelKey(kind as AccessAuditEventKind)]?.message).toBe(sentence);
  });

  it("falls back to the unknown label for a kind it has never heard of", () => {
    expect(auditKindLabelKey("somethingAddedLater" as AccessAuditEventKind)).toBe(
      "pamAuditKindUnknown",
    );
  });

  it("withholds exactly the kinds no action emits", () => {
    expect([...UNEMITTED_AUDIT_KINDS].sort()).toEqual(
      [
        "requestExpiredUnanswered",
        "requestExpiredUnactivated",
        "credentialAccessed",
        "credentialAccessDenied",
        "leasingKillSwitchTriggered",
        "leasingFreezeEnabled",
        "leasingFreezeLifted",
        "accessConnectorRevoked",
      ].sort(),
    );
  });
});
