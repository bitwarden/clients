/**
 * One audit event as a CSV record. The property names are the file's column headers, so this type is the
 * export's column contract: renaming or reordering a field changes every file the auditor has downloaded.
 *
 * Item and collection names are the display row's — decrypted from the exporter's own local vault state. An
 * item outside that vault exports an empty cell; the response's `cipherName` and `collectionName` are Vault
 * Data (EncStrings this client holds no key for in that case) and never reach the file.
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
  detail: string;
  automated: boolean;
  incomplete: boolean;
};
