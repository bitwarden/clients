import { CipherType } from "@bitwarden/common/vault/enums";

import { FinishedImportOutcome } from "../import-controls/import-outcome";

export interface ImportSummaryRow {
  icon: string;
  labelKey: string;
  count: number;
}

export interface ImportSummary {
  total: number;
  rows: ImportSummaryRow[];
}

const cipherTypeRows: { type: CipherType; icon: string; labelKey: string }[] = [
  { type: CipherType.Login, icon: "globe", labelKey: "typeLogin" },
  { type: CipherType.Card, icon: "credit-card", labelKey: "typeCard" },
  { type: CipherType.Identity, icon: "id-card", labelKey: "typeIdentity" },
  { type: CipherType.SecureNote, icon: "sticky-note", labelKey: "typeSecureNote" },
  { type: CipherType.SshKey, icon: "key", labelKey: "typeSshKey" },
  { type: CipherType.BankAccount, icon: "bank", labelKey: "typeBankAccount" },
  { type: CipherType.DriversLicense, icon: "id-card", labelKey: "typeDriversLicense" },
  { type: CipherType.Passport, icon: "passport", labelKey: "typePassport" },
];

export function summarizeImport(outcome: FinishedImportOutcome): ImportSummary {
  const counts = new Map<number, number>();
  let folders: number;
  let collections: number;

  if (outcome.kind === "importedWithSdk") {
    for (const { type, count } of outcome.sdkSummary.ciphers) {
      counts.set(type, (counts.get(type) ?? 0) + count);
    }
    folders = outcome.sdkSummary.folders;
    collections = outcome.sdkSummary.collections;
  } else {
    const { ciphers, folders: importedFolders, collections: importedCollections } = outcome.result;
    for (const { type } of ciphers) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    // The destination folder or collection is created by the import but isn't an imported item.
    folders = importedFolders.length - (outcome.result.targetFolderIncluded ? 1 : 0);
    collections = importedCollections.length - (outcome.result.targetCollectionIncluded ? 1 : 0);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const rows: ImportSummaryRow[] = [];
  for (const row of cipherTypeRows) {
    const count = counts.get(row.type) ?? 0;
    if (count > 0) {
      rows.push({ icon: row.icon, labelKey: row.labelKey, count });
    }
  }
  if (folders > 0) {
    rows.push({ icon: "folder", labelKey: "folders", count: folders });
  }
  if (collections > 0) {
    rows.push({ icon: "collection", labelKey: "collections", count: collections });
  }

  return { total, rows };
}
