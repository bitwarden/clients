/** A type of encrypted export. */
export const EncryptedExportType = Object.freeze({
  /** Export is encrypted using the Bitwarden account key. */
  AccountEncrypted: 0,
  /** Export is encrypted using a separate file password/key. */
  FileEncrypted: 1,
} as const);

/** A type of encrypted export. */
export type EncryptedExportType = (typeof EncryptedExportType)[keyof typeof EncryptedExportType];
