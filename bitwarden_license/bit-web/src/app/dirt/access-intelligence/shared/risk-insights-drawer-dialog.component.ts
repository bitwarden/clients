import { Component, ChangeDetectionStrategy, Inject } from "@angular/core";

import { DrawerDetails, DrawerType } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { exportToCSV } from "@bitwarden/web-vault/app/dirt/reports/report-utils";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

@Component({
  imports: [SharedModule],
  templateUrl: "./risk-insights-drawer-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsDrawerDialogComponent {
  constructor(
    @Inject(DIALOG_DATA) public drawerDetails: DrawerDetails,
    private fileDownloadService: FileDownloadService,
    private i18nService: I18nService,
    private logService: LogService,
  ) {}

  // Get a list of drawer types
  get drawerTypes(): typeof DrawerType {
    return DrawerType;
  }

  isActiveDrawerType(type: DrawerType): boolean {
    return this.drawerDetails.activeDrawerType === type;
  }

  /**
   * downloads at risk members as CSV
   */
  downloadAtRiskMembers() {
    try {
      // Validate drawer is open and showing the correct drawer type
      if (
        !this.drawerDetails.open ||
        this.drawerDetails.activeDrawerType !== DrawerType.OrgAtRiskMembers ||
        !this.drawerDetails.atRiskMemberDetails ||
        this.drawerDetails.atRiskMemberDetails.length === 0
      ) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-members"),
        blobData: exportToCSV(this.drawerDetails.atRiskMemberDetails, {
          email: this.i18nService.t("email"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      // Log error for debugging
      this.logService.error("Failed to download at-risk members", error);
    }
  }

  /**
   * downloads at risk applications as CSV
   */
  downloadAtRiskApplications() {
    try {
      // Validate drawer is open and showing the correct drawer type
      if (
        !this.drawerDetails.open ||
        this.drawerDetails.activeDrawerType !== DrawerType.OrgAtRiskApps ||
        !this.drawerDetails.atRiskAppDetails ||
        this.drawerDetails.atRiskAppDetails.length === 0
      ) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-applications"),
        blobData: exportToCSV(this.drawerDetails.atRiskAppDetails, {
          applicationName: this.i18nService.t("application"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      // Log error for debugging
      this.logService.error("Failed to download at-risk applications", error);
    }
  }
}
