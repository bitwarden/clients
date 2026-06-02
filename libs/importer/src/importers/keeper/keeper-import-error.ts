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
    // The item title, or empty when the item could not be read and its name is unknown.
    readonly name: string,
    readonly reason: ImportRecordErrorReason,
  ) {}
}
