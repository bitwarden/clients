import { Injectable, inject } from "@angular/core";
import * as papa from "papaparse";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { AuditRow } from "./access-audit-row";
import { AuditExport } from "./audit.export";

const FILE_NAME_PREFIX = "pam_audit";

/**
 * Characters a spreadsheet reads as opening a formula. Tab and carriage return count because Excel
 * drops leading whitespace, which can put a real trigger back in first position.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Guards against formula injection from free text such as approver comments. Escapes with a leading
 * apostrophe rather than stripping, so the file still matches what was recorded.
 */
function neutralizeFormula(value: string): string {
  return FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger)) ? `'${value}` : value;
}

/** Applied to the whole record rather than per field, so a column added later cannot be missed. */
function neutralizeRecord(record: AuditExport): AuditExport {
  return Object.fromEntries(
    Object.entries(record).map(([column, value]) => [
      column,
      typeof value === "string" ? neutralizeFormula(value) : value,
    ]),
  ) as AuditExport;
}

/** Builds the CSV in memory from rows the caller has already fetched. */
@Injectable({ providedIn: "root" })
export class AuditExportService {
  private readonly i18nService = inject(I18nService);

  getAuditExport(rows: AuditRow[]): string {
    return papa.unparse(rows.map((row) => this.toAuditExport(row)));
  }

  getFileName(): string {
    return ExportHelper.getFileName(FILE_NAME_PREFIX, "csv");
  }

  toAuditExport(row: AuditRow): AuditExport {
    return neutralizeRecord({
      timestamp: row.occurredAt.toISOString(),
      event: this.i18nService.t(row.kindLabelKey),
      actorName: row.actor ?? "",
      actorEmail: row.actorEmail ?? "",
      requesterName: row.requester ?? "",
      requesterEmail: row.requesterEmail ?? "",
      itemName: row.cipherName ?? "",
      collectionName: row.collectionName ?? "",
      ruleName: row.ruleName ?? "",
      targetSystemName: row.targetSystemName ?? "",
      accessConnectorName: row.accessConnectorName ?? "",
      grantedDuration:
        row.duration == null
          ? ""
          : this.i18nService.t(row.duration.key, row.duration.value ?? undefined),
      extendedUntil: row.extendedUntil == null ? "" : new Date(row.extendedUntil).toISOString(),
      detail: row.detail ?? "",
      automated: row.automated,
      incomplete: row.inDoubt,
      requestId: row.requestId ?? "",
      leaseId: row.leaseId ?? "",
    });
  }
}
