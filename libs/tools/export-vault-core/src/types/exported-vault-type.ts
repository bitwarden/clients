export type ExportedVaultAsBlob = {
  type: "application/zip";
  data: Blob;
  fileName: string;
  skippedAttachmentCount?: number;
};

export type ExportedVaultAsString = {
  type: "text/plain";
  data: string;
  fileName: string;
};

export type ExportedVault = ExportedVaultAsBlob | ExportedVaultAsString;
