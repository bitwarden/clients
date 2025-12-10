import { inject, Injectable } from "@angular/core";
import * as papa from "papaparse";

import { UserTypePipe } from "@bitwarden/angular/pipes/user-type.pipe";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { OrganizationUserView } from "../../../core";
import { UserStatusPipe } from "../../pipes";

import { MemberExport } from "./member.export";

@Injectable()
export class MemberExportService {
  private i18nService = inject(I18nService);
  private userTypePipe = inject(UserTypePipe);
  private userStatusPipe = inject(UserStatusPipe);

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
