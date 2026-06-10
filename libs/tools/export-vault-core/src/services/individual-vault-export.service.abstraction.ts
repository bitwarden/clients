import { UserId } from "@bitwarden/common/types/guid";

import { ExportedVault } from "../types";

import { ExportFormat } from "./vault-export.service.abstraction";

export abstract class IndividualVaultExportServiceAbstraction {
  abstract getExport: (userId: UserId, format: ExportFormat) => Promise<ExportedVault>;
  abstract getPasswordProtectedExport: (userId: UserId, password: string) => Promise<ExportedVault>;
}
