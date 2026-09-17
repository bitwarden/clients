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

  /**
   * The sentences, not just the keys. Renaming copy in messages.json means minting a new id, since the Crowdin
   * lint rejects editing one in place — so the same label can end up with two ids carrying two wordings, which
   * is how the fleet kinds shipped: `c99884f092` reworded them off "daemon" on the rotation stack while
   * `PM-43606` (aa9944be74) added this map on the audit stack and minted its own daemon-era ids for the same
   * labels. Both id sets merged, the map read the daemon-era one, and every assertion above stayed green
   * because each key did resolve to copy. These kinds carry the product's own vocabulary, so they are pinned
   * the way the request error catalog is (see the PAM CLAUDE.md): drift fails a test rather than degrading
   * the copy silently.
   */
  it.each([
    [AccessAuditEventKind.RotationOffered, "Rotation offered to access connector"],
    [AccessAuditEventKind.DaemonRegistered, "Access connector registered"],
    [AccessAuditEventKind.DaemonRevoked, "Access connector revoked"],
    [AccessAuditEventKind.DaemonDisabled, "Access connector deactivated"],
    [AccessAuditEventKind.DaemonEnabled, "Access connector activated"],
    [AccessAuditEventKind.DaemonDeleted, "Access connector deleted"],
    [AccessAuditEventKind.DaemonAssignedToTarget, "Access connector assigned to target"],
    [AccessAuditEventKind.DaemonUnassignedFromTarget, "Access connector unassigned from target"],
    [AccessAuditEventKind.TargetSystemDisabled, "Target system deactivated"],
    [AccessAuditEventKind.TargetSystemEnabled, "Target system activated"],
  ])("renders %s as its renamed copy, not the daemon-era wording", (kind, sentence) => {
    expect(localeMessages[auditKindLabelKey(kind as AccessAuditEventKind)]?.message).toBe(sentence);
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
