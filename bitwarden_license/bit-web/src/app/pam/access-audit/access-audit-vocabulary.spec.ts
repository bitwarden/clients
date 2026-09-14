// Namespace import: this workspace does not enable `esModuleInterop`, so a default import of a
// JSON module does not resolve to the whole document.
import * as messages from "@bitwarden/web-vault/locales/en/messages.json";

import { UNEMITTED_AUDIT_KINDS, auditKindLabelKey } from "./access-audit-row";
import { AccessAuditEventKind } from "./responses/access-audit-event.response";

/**
 * The other half of this contract is the server's `AccessAuditEventKindNames`, which is where the wire vocabulary
 * is defined and which has its own copy of the list below. The two drifted once (PM-43606): the server grew the
 * rotation and fleet kinds, this client did not, and every one of those rows read "Unknown event" while the Event
 * filter went on offering kinds nothing emits.
 */
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
        "daemonRegistered",
        "daemonRevoked",
        "daemonDisabled",
        "daemonEnabled",
        "daemonDeleted",
        "daemonAssignedToTarget",
        "daemonUnassignedFromTarget",
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

  // The fallback is for a server running ahead of this client, which is the state PM-43606 reported.
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
        "daemonRevoked",
      ].sort(),
    );
  });
});
