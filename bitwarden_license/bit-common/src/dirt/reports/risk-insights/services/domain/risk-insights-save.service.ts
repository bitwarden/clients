import { forkJoin, from, Observable, of, throwError } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { createNewSummaryData } from "../../helpers";
import { ApplicationHealthReportDetailEnriched } from "../../models";
import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import { OrganizationReportApplication, ReportState } from "../../models/report-models";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

/**
 * Parameters for saving report updates
 */
interface SaveReportUpdatesParams {
  reportState: ReportState;
  organizationDetails: { organizationId: OrganizationId; organizationName: string };
  userId: UserId;
  updatedApplicationData: OrganizationReportApplication[];
}

/**
 * Result of saving report updates
 */
interface SaveReportUpdatesResult {
  updatedState: ReportState;
  metrics: RiskInsightsMetrics;
}

/**
 * Service responsible for saving Risk Insights report updates to the backend.
 *
 * By extracting this logic, we reduce code duplication in the orchestrator service
 * and provide a single source of truth for the save workflow.
 */
export class RiskInsightsSaveService {
  constructor(
    private riskInsightsApiService: RiskInsightsApiService,
    private riskInsightsEncryptionService: RiskInsightsEncryptionService,
    private reportService: RiskInsightsReportService,
    private logService: LogService,
  ) {}

  /**
   * Saves updated application data and recomputed summary/metrics to the backend.
   *
   * This method performs the following steps:
   * 1. Recomputes summary and metrics from updated application data
   * 2. Encrypts applicationData and summaryData (NOT reportData)
   * 3. Calls 2 API endpoints in parallel: updateRiskInsightsApplicationData$ and updateRiskInsightsSummary$
   * 4. Returns updated state and metrics
   *
   * @param params Save parameters including current state and updated application data
   * @returns Observable of updated report state with new metrics
   */
  saveReportUpdates$(params: SaveReportUpdatesParams): Observable<SaveReportUpdatesResult> {
    const { organizationDetails, userId } = params;

    return of(params).pipe(
      // Recompute summary and metrics from updated application data
      map(({ reportState, updatedApplicationData }) => {
        const report = reportState?.data;
        if (!report) {
          throw new Error("Cannot save report updates without report data");
        }

        // Recompute summary with updated critical/reviewed applications
        const updatedSummaryData = this.reportService.getApplicationsSummary(
          report.reportData,
          updatedApplicationData,
          report.summaryData.totalMemberCount,
        );

        // Create enriched applications for metrics calculation
        const enrichedApplications = report.reportData.map(
          (application): ApplicationHealthReportDetailEnriched => ({
            ...application,
            isMarkedAsCritical: this.reportService.isCriticalApplication(
              application,
              updatedApplicationData,
            ),
          }),
        );

        // Calculate updated metrics
        const metrics = this.reportService.getReportMetrics(
          enrichedApplications,
          updatedSummaryData,
        );

        const updatedState: ReportState = {
          ...reportState,
          data: {
            ...report,
            summaryData: updatedSummaryData,
            applicationData: updatedApplicationData,
          },
        };

        return { reportState, updatedState, metrics };
      }),

      // Encrypt the updated data
      switchMap(({ reportState, updatedState, metrics }) => {
        return from(
          this.riskInsightsEncryptionService.encryptRiskInsightsReport(
            { organizationId: organizationDetails.organizationId, userId },
            {
              reportData: reportState?.data?.reportData ?? [],
              summaryData: updatedState?.data?.summaryData ?? createNewSummaryData(),
              applicationData: updatedState?.data?.applicationData ?? [],
            },
            reportState?.data?.contentEncryptionKey,
          ),
        ).pipe(
          map((encryptedData) => ({
            reportState,
            updatedState,
            encryptedData,
            metrics,
          })),
        );
      }),

      // Save to backend via parallel API calls
      switchMap(({ reportState, updatedState, encryptedData, metrics }) => {
        this.logService.debug(
          `[RiskInsightsSaveService] Saving report updates - report id: ${reportState?.data?.id}`,
        );

        if (!reportState?.data?.id || !organizationDetails?.organizationId) {
          this.logService.warning(
            "[RiskInsightsSaveService] Cannot save - missing report id or org id",
          );
          return of({ updatedState, metrics });
        }

        // Update applications data
        const updateApplicationsCall =
          this.riskInsightsApiService.updateRiskInsightsApplicationData$(
            reportState.data.id,
            organizationDetails.organizationId,
            {
              data: {
                applicationData: encryptedData.encryptedApplicationData.toSdk(),
              },
            },
          );

        // Update summary data
        const updateSummaryCall = this.riskInsightsApiService.updateRiskInsightsSummary$(
          reportState.data.id,
          organizationDetails.organizationId,
          {
            data: {
              summaryData: encryptedData.encryptedSummaryData.toSdk(),
              metrics: metrics.toRiskInsightsMetricsData(),
            },
          },
        );

        return forkJoin([updateApplicationsCall, updateSummaryCall]).pipe(
          map(() => ({ updatedState, metrics })),
          catchError((error: unknown) => {
            this.logService.error("[RiskInsightsSaveService] Failed to save report updates", error);
            return throwError(() => error);
          }),
        );
      }),
    );
  }
}
