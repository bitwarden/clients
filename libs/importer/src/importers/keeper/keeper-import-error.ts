export const ImportRecordErrorReason = Object.freeze({
  Error: "error",
  UnsupportedFeature: "unsupportedFeature",
  UnsupportedType: "unsupportedType",
  FolderDecryptionFailed: "folderDecryptionFailed",
} as const);
export type ImportRecordErrorReason =
  (typeof ImportRecordErrorReason)[keyof typeof ImportRecordErrorReason];

export class ImportRecordError {
  constructor(
    // The record/folder UID. Always available without decryption.
    readonly id: string,
    readonly reason: ImportRecordErrorReason,
    // Raw Keeper record type (e.g. "login", "bankCard", "file"). Undefined when the item could not
    // be read, so its type is unknown.
    readonly type?: string,
  ) {}
}
