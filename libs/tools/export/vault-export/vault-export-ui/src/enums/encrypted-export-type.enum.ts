export const EncryptedExportType = Object.freeze({
  AccountEncrypted: 0,
  FileEncrypted: 1,
} as const);

export type EncryptedExportType = (typeof EncryptedExportType)[keyof typeof EncryptedExportType];
