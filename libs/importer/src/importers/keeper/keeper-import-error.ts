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
    readonly name: string,
    readonly reason: ImportRecordErrorReason,
  ) {}
}
