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
 * The tab and the carriage return are triggers in their own right because Excel drops leading
 * whitespace before deciding what a cell is, so a value can reach the formula parser with the
 * character that matters no longer in first position.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * One cell, neutralized against spreadsheet formula injection.
 *
 * Most of this file is free text an auditor never chose: an approver's comment, a revoke reason, a
 * name someone else set. A cell that opens with a formula trigger is evaluated when the file is
 * opened, so that text can run as a formula in the spreadsheet of the one reader this export exists
 * for — the classic form being a `HYPERLINK` that carries a neighbouring cell to an attacker's host.
 *
 * A leading apostrophe is what Excel, LibreOffice and Sheets each read as "the rest of this cell is
 * text". It is applied only where a cell would otherwise evaluate, so an ordinary name or comment is
 * written through untouched, and it is an escape rather than a strip because an audit record must not
 * quietly differ from what was recorded — the auditor has to read the comment that was actually left.
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
      detail: row.detail ?? "",
      automated: row.automated,
      incomplete: row.inDoubt,
    });
  }
}
