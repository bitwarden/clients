export const ImportRecordErrorReason = Object.freeze({
  Error: "error",
  UnsupportedFeature: "unsupportedFeature",
  UnsupportedType: "unsupportedType",
  FolderDecryptionFailed: "folderDecryptionFailed",
  SshKeyParseFailed: "sshKeyParseFailed",
} as const);
export type ImportRecordErrorReason =
  (typeof ImportRecordErrorReason)[keyof typeof ImportRecordErrorReason];

/**
 * A single item an importer could not import, surfaced to the user so the rest of the import can
 * still succeed. Carries only non-sensitive identifiers — never Vault Data.
 */
export class ImportRecordError {
  constructor(
    // A stable, non-sensitive identifier for the failed record (a UID), shown to the user so they
    // can locate it in the source.
    readonly id: string,
    readonly reason: ImportRecordErrorReason,
    // Optional record type, used by importers that group skipped items by type in their summary
    // dialog (e.g. "login"). Undefined when the type is unknown or the importer doesn't group.
    readonly type?: string,
  ) {}
}
