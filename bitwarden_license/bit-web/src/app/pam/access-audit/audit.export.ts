/**
 * One audit event as a CSV record. Property names are the column headers, so renaming or
 * reordering one changes every downloaded file. Items outside the exporter's vault export no name.
 */
export type AuditExport = {
  /** ISO 8601 UTC rather than the table's local time, since the file is opened anywhere. */
  timestamp: string;
  /** The event label as the table shows it. */
  event: string;
  actorName: string;
  actorEmail: string;
  requesterName: string;
  requesterEmail: string;
  itemName: string;
  collectionName: string;
  ruleName: string;
  targetSystemName: string;
  accessConnectorName: string;
  /** Localized as the Duration cell renders it. */
  grantedDuration: string;
  /** A `LeaseExtended` event's new lease end, in ISO 8601 UTC; empty on every other kind. */
  extendedUntil: string;
  detail: string;
  automated: boolean;
  incomplete: boolean;
  requestId: string;
  /** The id support asks for; the table has no column for it. */
  leaseId: string;
};
