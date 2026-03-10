import { firstValueFrom, forkJoin, from, map, Observable, of, switchMap, throwError } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { RiskInsightsData } from "../../models/data/risk-insights.data";
import { RiskInsights } from "../../models/domain/risk-insights";
import { RiskInsightsView } from "../../models/view/risk-insights.view";
import { AccessReportEncryptionService } from "../abstractions/access-report-encryption.service";
import { ReportPersistenceService } from "../abstractions/report-persistence.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

/**
 * Default implementation of ReportPersistenceService using current DB backend.
 *
 * Delegates encryption/decryption to domain model.
 * Orchestrates API calls for persistence operations.
 */
export class DefaultReportPersistenceService extends ReportPersistenceService {
  constructor(
    private riskInsightsApiService: RiskInsightsApiService,
    private riskInsightsEncryptionService: AccessReportEncryptionService,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    super();
  }

  saveReport$(
    view: RiskInsightsView,
    organizationId: OrganizationId,
  ): Observable<{ id: OrganizationReportId; contentEncryptionKey: EncString }> {
    this.logService.debug("[DefaultReportPersistenceService] Saving report", {
      organizationId,
    });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error("User ID not found");
        }

        // Encrypt view to domain model
        return from(
          RiskInsights.fromView(view, this.riskInsightsEncryptionService, {
            organizationId,
            userId,
          }),
        ).pipe(
          switchMap((domain) => {
            if (!domain.contentEncryptionKey) {
              return throwError(() => new Error("Report encryption key not found"));
            }

            // Extract encrypted data and compute metrics from view
            const data = domain.toData();
            const metrics = view.toMetrics();

            const requestPayload = {
              data: {
                organizationId,
                creationDate: data.creationDate,
                reportData: data.reports,
                summaryData: data.summary,
                applicationData: data.applications,
                contentEncryptionKey: data.contentEncryptionKey,
                metrics: metrics.toRiskInsightsMetricsData(),
              },
            };

            return this.riskInsightsApiService
              .saveRiskInsightsReport$(requestPayload, organizationId)
              .pipe(
                map((response) => ({
                  id: response.id,
                  contentEncryptionKey: domain.contentEncryptionKey!,
                })),
              );
          }),
        );
      }),
    );
  }

  saveApplicationMetadata$(view: RiskInsightsView): Observable<void> {
    this.logService.debug("[DefaultReportPersistenceService] Saving application metadata", {
      reportId: view.id,
      organizationId: view.organizationId,
      applicationCount: view.applications.length,
    });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error("User ID not found");
        }

        // Encrypt view to domain model
        return from(
          RiskInsights.fromView(view, this.riskInsightsEncryptionService, {
            organizationId: view.organizationId,
            userId,
          }),
        ).pipe(
          switchMap((domain) => {
            const data = domain.toData();
            const metrics = view.toMetrics();

            const updateApplicationsCall =
              this.riskInsightsApiService.updateRiskInsightsApplicationData$(
                view.id,
                view.organizationId,
                {
                  data: {
                    applicationData: data.applications,
                  },
                },
              );

            const updateSummaryCall = this.riskInsightsApiService.updateRiskInsightsSummary$(
              view.id,
              view.organizationId,
              {
                data: {
                  summaryData: data.summary,
                  metrics: metrics.toRiskInsightsMetricsData(),
                },
              },
            );

            return forkJoin([updateApplicationsCall, updateSummaryCall]).pipe(
              map(() => undefined as void),
            );
          }),
        );
      }),
    );
  }

  // TODO Rename to loadLastReport$
  loadReport$(organizationId: OrganizationId): Observable<RiskInsightsView | null> {
    this.logService.debug("[DefaultReportPersistenceService] Loading report", { organizationId });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error("User ID not found");
        }

        return this.riskInsightsApiService.getRiskInsightsReport$(organizationId).pipe(
          switchMap((apiResponse) => {
            if (!apiResponse) {
              return of(null);
            }

            if (
              !apiResponse.contentEncryptionKey ||
              !apiResponse.contentEncryptionKey.encryptedString ||
              apiResponse.contentEncryptionKey.encryptedString === ""
            ) {
              throw new Error("Report encryption key not found");
            }

            // Convert API → Data → Domain → View (following 4-layer architecture)
            const data = new RiskInsightsData();
            data.id = apiResponse.id;
            data.organizationId = apiResponse.organizationId;
            data.reports = apiResponse.reportData.encryptedString ?? "";
            data.summary = apiResponse.summaryData.encryptedString ?? "";
            data.applications = apiResponse.applicationData.encryptedString ?? "";
            data.creationDate = apiResponse.creationDate.toISOString();
            data.contentEncryptionKey = apiResponse.contentEncryptionKey.encryptedString ?? "";

            const domain = new RiskInsights(data);

            // Domain handles its own decryption
            return from(
              domain.decrypt(this.riskInsightsEncryptionService, { organizationId, userId }),
            );
          }),
        );
      }),
    );
  }
}
