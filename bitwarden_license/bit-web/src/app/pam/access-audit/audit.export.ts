/**
 * One audit event as a CSV record. Property names are the file's column headers, so renaming or
 * reordering one changes every downloaded file.
 *
 * Item and collection names are decrypted from the exporter's own local vault state; an item
 * outside that vault exports an empty cell, since those fields are Vault Data this client may
 * hold no key for.
 */
export type AuditExport = {
  /**
   * The event's instant as a full ISO 8601 UTC timestamp, rather than the table's zone-local rendering: the
   * file outlives the session that produced it and is read wherever the auditor opens it.
   */
  timestamp: string;
  /** The event label as the table shows it, resolved through the same i18n key. */
  event: string;
  actorName: string;
  actorEmail: string;
  requesterName: string;
  requesterEmail: string;
  itemName: string;
  collectionName: string;
  ruleName: string;
  /** The length of the granted access window, localized as the Duration cell localizes it. */
  grantedDuration: string;
  /**
   * The new lease end a `LeaseExtended` event records, as a full ISO 8601 UTC timestamp. That kind carries no
   * granted window, so it is the only field on the record that says what the extension did. Empty on every
   * other kind.
   */
  extendedUntil: string;
  detail: string;
  automated: boolean;
  incomplete: boolean;
  /** The request this event belongs to, if any — a correlation id joining this file to another export or a ticket. */
  requestId: string;
  /** The lease this event belongs to, if any — the id support asks for; the table has no column for it. */
  leaseId: string;
};
