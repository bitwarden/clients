export type ExportedVaultAsBlob = {
  type: "application/zip";
  data: Blob;
  fileName: string;
};

export type ExportedVaultAsString = {
  type: "text/plain";
  data: string;
  fileName: string;
};

export type ExportedVault = ExportedVaultAsBlob | ExportedVaultAsString;
