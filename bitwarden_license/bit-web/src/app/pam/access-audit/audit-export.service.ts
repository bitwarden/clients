import { Injectable, inject } from "@angular/core";
import * as papa from "papaparse";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { AuditRow } from "./access-audit-row";
import { AuditExport } from "./audit.export";

const FILE_NAME_PREFIX = "pam_audit";

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
   */
  toAuditExport(row: AuditRow): AuditExport {
    return {
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
    };
  }
}
