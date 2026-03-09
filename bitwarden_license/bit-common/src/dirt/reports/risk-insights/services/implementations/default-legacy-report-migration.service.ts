import { Injectable } from "@angular/core";
import { catchError, from, map, Observable, of, switchMap, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models/report-models";
import { MemberRegistryEntryView } from "../../models/view/member-details.view";
import { RiskInsightsApplicationView } from "../../models/view/risk-insights-application.view";
import { RiskInsightsReportView } from "../../models/view/risk-insights-report.view";
import { RiskInsightsSummaryView } from "../../models/view/risk-insights-summary.view";
import { MemberRegistry, RiskInsightsView } from "../../models/view/risk-insights.view";
import { LegacyReportMigrationService } from "../abstractions/legacy-report-migration.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { LegacyRiskInsightsEncryptionService } from "./legacy-risk-insights-encryption.service";

/**
 * Default implementation of LegacyReportMigrationService.
 *
 * Handles one-time migration of V1 Access Intelligence reports to V2 architecture.
 * Transforms V1 data structures (duplicated member arrays) to V2 models (member registry pattern).
 */
@Injectable()
export class DefaultLegacyReportMigrationService extends LegacyReportMigrationService {
  constructor(
    private riskInsightsApiService: RiskInsightsApiService,
    private encryptionService: LegacyRiskInsightsEncryptionService,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    super();
  }

  migrateV1Report$(orgId: OrganizationId): Observable<RiskInsightsView | null> {
    this.logService.info(`[LegacyReportMigration] Attempting V1 report load for org ${orgId}`);

    return from(this.getUserId$()).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error("User ID not found for V1 migration");
        }

        this.logService.debug(`[LegacyReportMigration] User ID: ${userId}`);

        // Load V1 report from API (same endpoint as V2)
        return this.riskInsightsApiService.getRiskInsightsReport$(orgId).pipe(
          switchMap((apiResponse) => {
            if (!apiResponse) {
              this.logService.info("[LegacyReportMigration] No V1 report found in database");
              return of(null);
            }

            this.logService.info(
              `[LegacyReportMigration] V1 report found (ID: ${apiResponse.id}, Created: ${apiResponse.creationDate})`,
            );
            this.logService.debug("[LegacyReportMigration] Checking encrypted data presence...");
            this.logService.debug(
              `  - reportData: ${apiResponse.reportData ? "present" : "MISSING"}`,
            );
            this.logService.debug(
              `  - summaryData: ${apiResponse.summaryData ? "present" : "MISSING"}`,
            );
            this.logService.debug(
              `  - applicationData: ${apiResponse.applicationData ? "present" : "MISSING"}`,
            );
            this.logService.debug(
              `  - contentEncryptionKey: ${apiResponse.contentEncryptionKey ? "present" : "MISSING"}`,
            );

            this.logService.info("[LegacyReportMigration] Starting decryption...");

            // Decrypt using V1 encryption service
            return from(
              this.encryptionService.decryptRiskInsightsReport(
                {
                  organizationId: orgId,
                  userId,
                },
                {
                  encryptedReportData: apiResponse.reportData,
                  encryptedSummaryData: apiResponse.summaryData,
                  encryptedApplicationData: apiResponse.applicationData,
                },
                apiResponse.contentEncryptionKey,
              ),
            ).pipe(
              map((decryptedData) => {
                this.logService.info("[LegacyReportMigration] Transforming V1 → V2...");
                return this.transformV1ToV2(
                  decryptedData.reportData,
                  decryptedData.summaryData,
                  decryptedData.applicationData,
                  apiResponse.id,
                  orgId,
                  apiResponse.creationDate,
                );
              }),
            );
          }),
          catchError((error: unknown) => {
            this.logService.error("[LegacyReportMigration] Failed to migrate V1 report", error);
            return of(null);
          }),
        );
      }),
    );
  }

  /**
   * Transform V1 data structures to V2 view model
   *
   * Converts:
   * - Duplicated member arrays → Deduplicated member registry
   * - Member arrays → memberRefs (Record<memberId, isAtRisk>)
   * - Cipher arrays → cipherRefs (Record<cipherId, isAtRisk>)
   */
  private transformV1ToV2(
    v1ReportData: ApplicationHealthReportDetail[],
    v1SummaryData: OrganizationReportSummary,
    v1ApplicationData: OrganizationReportApplication[],
    reportId: string,
    organizationId: OrganizationId,
    creationDate: Date,
  ): RiskInsightsView {
    const view = new RiskInsightsView();
    view.id = reportId as OrganizationReportId;
    view.organizationId = organizationId;
    view.creationDate = creationDate;

    // Step 1: Build member registry from V1 member arrays (deduplicate)
    const memberRegistry: MemberRegistry = {};
    v1ReportData.forEach((app) => {
      app.memberDetails.forEach((member: MemberDetails) => {
        if (!memberRegistry[member.userGuid]) {
          memberRegistry[member.userGuid] = MemberRegistryEntryView.fromData({
            id: member.userGuid,
            userName: member.userName ?? undefined,
            email: member.email,
          });
        }
      });
    });
    view.memberRegistry = memberRegistry;

    // Step 2: Transform reports (convert member arrays to memberRefs)
    view.reports = v1ReportData.map((v1App) => {
      const report = new RiskInsightsReportView();
      report.applicationName = v1App.applicationName;
      report.passwordCount = v1App.passwordCount;
      report.atRiskPasswordCount = v1App.atRiskPasswordCount;
      report.memberCount = v1App.memberCount;
      report.atRiskMemberCount = v1App.atRiskMemberCount;

      // Convert member arrays to memberRefs Record
      const memberRefs: Record<string, boolean> = {};
      const atRiskMemberIds = new Set(
        v1App.atRiskMemberDetails.map((m: MemberDetails) => m.userGuid),
      );

      v1App.memberDetails.forEach((member: MemberDetails) => {
        memberRefs[member.userGuid] = atRiskMemberIds.has(member.userGuid);
      });
      report.memberRefs = memberRefs;

      // Convert cipher arrays to cipherRefs Record
      const cipherRefs: Record<string, boolean> = {};
      const atRiskCipherIds = new Set(v1App.atRiskCipherIds);

      v1App.cipherIds.forEach((cipherId) => {
        cipherRefs[cipherId] = atRiskCipherIds.has(cipherId);
      });
      report.cipherRefs = cipherRefs;

      return report;
    });

    // Step 3: Transform applications (metadata)
    view.applications = v1ApplicationData.map((v1App) => {
      const app = new RiskInsightsApplicationView();
      app.applicationName = v1App.applicationName;
      app.isCritical = v1App.isCritical;
      app.reviewedDate = v1App.reviewedDate ?? undefined;
      return app;
    });

    // Step 4: Copy summary (structure is same)
    const summary = new RiskInsightsSummaryView();
    summary.totalMemberCount = v1SummaryData.totalMemberCount;
    summary.totalApplicationCount = v1SummaryData.totalApplicationCount;
    summary.totalAtRiskMemberCount = v1SummaryData.totalAtRiskMemberCount;
    summary.totalAtRiskApplicationCount = v1SummaryData.totalAtRiskApplicationCount;
    summary.totalCriticalApplicationCount = v1SummaryData.totalCriticalApplicationCount;
    summary.totalCriticalMemberCount = v1SummaryData.totalCriticalMemberCount;
    summary.totalCriticalAtRiskMemberCount = v1SummaryData.totalCriticalAtRiskMemberCount;
    summary.totalCriticalAtRiskApplicationCount = v1SummaryData.totalCriticalAtRiskApplicationCount;
    view.summary = summary;

    this.logService.info(
      `[LegacyReportMigration] Migration complete: ${view.reports.length} apps, ${Object.keys(memberRegistry).length} members`,
    );

    return view;
  }

  /**
   * Get the current user ID from account service
   */
  private async getUserId$(): Promise<UserId> {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount?.id) {
      throw new Error("Active account ID not found");
    }
    return activeAccount.id as UserId;
  }
}
