export const VaultRecordErrorReason = Object.freeze({
  DecryptionFailed: "decryptionFailed",
  UnsupportedVersion: "unsupportedVersion",
  FolderDecryptionFailed: "folderDecryptionFailed",
} as const);
export type VaultRecordErrorReason =
  (typeof VaultRecordErrorReason)[keyof typeof VaultRecordErrorReason];

export type VaultRecordError = {
  id: string;
  reason: VaultRecordErrorReason;
};
