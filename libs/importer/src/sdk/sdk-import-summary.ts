/**
 * Normalized result of an SDK-backed import (the SDK has already encrypted and submitted). Rendered
 * by the import success dialog. `type` is a numeric cipher type ({@link CipherType}); kept as
 * `number` so the SDK's own cipher-type enum is structurally assignable here.
 */
export interface SdkImportSummary {
  ciphers: { type: number; count: number }[];
  folders: number;
  collections: number;
}

/** Nothing was imported: no items, folders or collections. */
export function isEmptySdkSummary(summary: SdkImportSummary): boolean {
  return (
    summary.folders === 0 &&
    summary.collections === 0 &&
    summary.ciphers.every(({ count }) => count === 0)
  );
}
