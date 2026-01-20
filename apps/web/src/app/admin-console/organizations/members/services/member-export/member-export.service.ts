import { inject, Injectable } from "@angular/core";
import * as papa from "papaparse";

import { UserTypePipe } from "@bitwarden/angular/pipes/user-type.pipe";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { OrganizationUserView } from "../../../core";
import { UserStatusPipe } from "../../pipes";

import { MemberExport } from "./member.export";

export interface MemberExportResult {
  success: boolean;
  error?: { message: string };
}

@Injectable()
export class MemberExportService {
  private i18nService = inject(I18nService);
  private userTypePipe = inject(UserTypePipe);
  private userStatusPipe = inject(UserStatusPipe);
  private fileDownloadService = inject(FileDownloadService);
  private logService = inject(LogService);

  getMemberExport(data: OrganizationUserView[]): MemberExportResult {
    try {
      const members = data;
      if (!members || members.length === 0) {
        return { success: false, error: { message: this.i18nService.t("noMembersToExport") } };
      }

      const exportData = members.map((m) =>
        MemberExport.fromOrganizationUserView(
          this.i18nService,
          this.userTypePipe,
          this.userStatusPipe,
          m,
        ),
      );

      const headers: string[] = [
        this.i18nService.t("email"),
        this.i18nService.t("name"),
        this.i18nService.t("status"),
        this.i18nService.t("role"),
        this.i18nService.t("twoStepLogin"),
        this.i18nService.t("accountRecovery"),
        this.i18nService.t("secretsManager"),
        this.i18nService.t("groups"),
      ];

      const csvData = papa.unparse(exportData, {
        columns: headers,
        header: true,
      });

      const fileName = this.getFileName("org-members");

      this.fileDownloadService.download({
        fileName: fileName,
        blobData: csvData,
        blobOptions: { type: "text/plain" },
      });

      return { success: true };
    } catch (error) {
      this.logService.error(`Failed to export members: ${error}`);

      const errorMessage =
        error instanceof Error ? error.message : this.i18nService.t("unexpectedError");

      return { success: false, error: { message: errorMessage } };
    }
  }

  private getFileName(prefix: string | null = null, extension = "csv"): string {
    return ExportHelper.getFileName(prefix ?? "", extension);
  }
}
