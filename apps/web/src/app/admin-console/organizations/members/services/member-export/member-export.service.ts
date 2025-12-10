import { Injectable } from "@angular/core";
import * as papa from "papaparse";

import { UserStatusPipe } from "@bitwarden/angular/pipes/user-status.pipe";
import { UserTypePipe } from "@bitwarden/angular/pipes/user-type.pipe";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { OrganizationUserView } from "../../../core";

import { MemberExport } from "./member.export";

@Injectable({
  providedIn: "root",
})
export class MemberExportService {
  private userTypePipe: UserTypePipe;
  private userStatusPipe: UserStatusPipe;

  constructor(private i18nService: I18nService) {
    this.userTypePipe = new UserTypePipe(i18nService);
    this.userStatusPipe = new UserStatusPipe(i18nService);
  }

  getMemberExport(members: OrganizationUserView[]): string {
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

    return papa.unparse(exportData, {
      columns: headers,
      header: true,
    });
  }

  getFileName(prefix: string | null = null, extension = "csv"): string {
    return ExportHelper.getFileName(prefix ?? "", extension);
  }
}
