import { Component, ChangeDetectionStrategy, inject } from "@angular/core";

import { DrawerType } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { exportToCSV } from "@bitwarden/web-vault/app/dirt/reports/report-utils";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { DrawerContentData } from "../../models/drawer-content-data.types";

/**
 * V2 Drawer Component - Pure Presentation
 *
 * Key Difference from V1:
 * - Takes pre-computed DrawerContentData via DIALOG_DATA injection
 * - No service dependencies for content (parent derives content from report$ + drawerState)
 * - Content automatically updates when parent re-derives from report changes
 */
@Component({
  selector: "dirt-access-intelligence-drawer-v2",
  imports: [SharedModule],
  templateUrl: "./access-intelligence-drawer-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessIntelligenceDrawerV2Component {
  /**
   * Drawer content derived by parent component from report$ + drawerState.
   * Parent uses view model query methods (e.g., report.getAtRiskMembers()).
   */
  protected data = inject<DrawerContentData>(DIALOG_DATA);

  // Services
  private fileDownloadService = inject(FileDownloadService);
  private i18nService = inject(I18nService);
  private logService = inject(LogService);

  // Expose DrawerType enum to template
  protected readonly DrawerType = DrawerType;

  /**
   * Downloads at-risk members as CSV.
   * Only available for OrgAtRiskMembers and CriticalAtRiskMembers drawer types.
   */
  downloadAtRiskMembers(): void {
    try {
      if (
        this.data.type !== DrawerType.OrgAtRiskMembers &&
        this.data.type !== DrawerType.CriticalAtRiskMembers
      ) {
        return;
      }

      const members = this.data.members;
      if (!members || members.length === 0) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-members"),
        blobData: exportToCSV(members, {
          email: this.i18nService.t("email"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      this.logService.error("Failed to download at-risk members", error);
    }
  }

  /**
   * Downloads at-risk applications as CSV.
   * Only available for OrgAtRiskApps and CriticalAtRiskApps drawer types.
   */
  downloadAtRiskApplications(): void {
    try {
      if (
        this.data.type !== DrawerType.OrgAtRiskApps &&
        this.data.type !== DrawerType.CriticalAtRiskApps
      ) {
        return;
      }

      const applications = this.data.applications;
      if (!applications || applications.length === 0) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-applications"),
        blobData: exportToCSV(applications, {
          applicationName: this.i18nService.t("application"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      this.logService.error("Failed to download at-risk applications", error);
    }
  }
}
