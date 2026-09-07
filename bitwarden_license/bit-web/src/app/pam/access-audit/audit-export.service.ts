import { Injectable, inject } from "@angular/core";
import * as papa from "papaparse";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { AuditRow } from "./access-audit-row";
import { AuditExport } from "./audit.export";

const FILE_NAME_PREFIX = "pam_audit";

/**
 * The characters a spreadsheet reads as the opening of a formula rather than as text.
 *
 * Tab and carriage return are triggers in their own right: Excel drops leading whitespace before
 * deciding what a cell is, so the real trigger character can land back in first position.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * One cell, neutralized against spreadsheet formula injection.
 *
 * Most of this file is free text an auditor never chose — an approver's comment, a revoke
 * reason, a name someone else set — and a cell opening with a formula trigger would be evaluated
 * on open, the classic case being a `HYPERLINK` that carries a neighbouring cell to an
 * attacker's host.
 *
 * A leading apostrophe is what Excel, LibreOffice and Sheets read as "the rest of this cell is
 * text", applied only where a cell would otherwise evaluate. An escape, not a strip: an audit
 * record must not quietly differ from what was recorded.
 */
function neutralizeFormula(value: string): string {
  return FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger)) ? `'${value}` : value;
}

/**
 * Every string cell of a record neutralized, applied to the assembled record rather than field by
 * field so a column added later cannot be the one that was forgotten.
 */
function neutralizeRecord(record: AuditExport): AuditExport {
  return Object.fromEntries(
    Object.entries(record).map(([column, value]) => [
      column,
      typeof value === "string" ? neutralizeFormula(value) : value,
    ]),
  ) as AuditExport;
}

/**
 * Turns already-fetched audit rows into a CSV file, in memory. Nothing here reads the network: the trail the
 * caller passes in is the one the table is already showing, and the result goes straight to the download.
 */
@Injectable({ providedIn: "root" })
export class AuditExportService {
  private readonly i18nService = inject(I18nService);

  /** The rows as CSV, one record per row, in the order given. */
  getAuditExport(rows: AuditRow[]): string {
    return papa.unparse(rows.map((row) => this.toAuditExport(row)));
  }

  getFileName(): string {
    return ExportHelper.getFileName(FILE_NAME_PREFIX, "csv");
  }

  /**
   * One row as its CSV record. Every absent value becomes an empty cell rather than the text "null", and the
   * event label and duration go through the i18n keys the cells render, so the file and the screen agree.
   * Every string cell is neutralized against formula injection on the way out (see {@link neutralizeFormula}).
   */
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
