import { catchError, EMPTY, from, map, Observable, of, switchMap, throwError } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { getUniqueMembers } from "../../helpers/risk-insights-data-mappers";
import {
  isSaveRiskInsightsReportResponse,
  SaveRiskInsightsReportResponse,
} from "../../models/api-models.types";
import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import {
  ApplicationHealthReportDetail,
  OrganizationReportSummary,
  CipherHealthReport,
  PasswordHealthData,
  OrganizationReportApplication,
  RiskInsightsData,
} from "../../models/report-models";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";

export class RiskInsightsReportService {
  constructor(
    private riskInsightsApiService: RiskInsightsApiService,
    private riskInsightsEncryptionService: RiskInsightsEncryptionService,
  ) {}

  filterApplicationsByCritical(
    report: ApplicationHealthReportDetail[],
    applicationData: OrganizationReportApplication[],
  ): ApplicationHealthReportDetail[] {
    return report.filter((application) => this.isCriticalApplication(application, applicationData));
  }

  /**
   * Report data for the aggregation of uris to like uris and getting password/member counts,
   * members, and at risk statuses.
   *
   * @param ciphers The list of ciphers to analyze
   * @param memberCiphers The list of member cipher details to associate members to ciphers
   * @returns The all applications health report data
   */
  generateApplicationsReport(ciphers: CipherHealthReport[]): ApplicationHealthReportDetail[] {
    const groupedByApplication = this._groupCiphersByApplication(ciphers);

    return Array.from(groupedByApplication.entries()).map(([application, ciphers]) =>
      this._getApplicationHealthReport(application, ciphers),
    );
  }

  /**
   *
   * @param applications The list of application health report details to map ciphers to
   * @param organizationId
   * @returns
   */
  getApplicationCipherMap(
    ciphers: CipherView[],
    applications: ApplicationHealthReportDetail[],
  ): Map<string, CipherView[]> {
    const cipherMap = new Map<string, CipherView[]>();
    applications.forEach((app) => {
      const filteredCiphers = ciphers.filter((c) => app.cipherIds.includes(c.id));
      cipherMap.set(app.applicationName, filteredCiphers);
    });
    return cipherMap;
  }

  /**
   * Gets the summary from the application health report. Returns total members and applications as well
   * as the total at risk members and at risk applications
   * @param reports The previously calculated application health report data
   * @returns A summary object containing report totals
   */
  getApplicationsSummary(
    reports: ApplicationHealthReportDetail[],
    applicationData: OrganizationReportApplication[],
  ): OrganizationReportSummary {
    const totalUniqueMembers = getUniqueMembers(reports.flatMap((x) => x.memberDetails));
    const atRiskUniqueMembers = getUniqueMembers(reports.flatMap((x) => x.atRiskMemberDetails));

    const criticalReports = this.filterApplicationsByCritical(reports, applicationData);
    const criticalUniqueMembers = getUniqueMembers(criticalReports.flatMap((x) => x.memberDetails));
    const criticalAtRiskUniqueMembers = getUniqueMembers(
      criticalReports.flatMap((x) => x.atRiskMemberDetails),
    );

    return {
      totalMemberCount: totalUniqueMembers.length,
      totalAtRiskMemberCount: atRiskUniqueMembers.length,
      totalApplicationCount: reports.length,
      totalAtRiskApplicationCount: reports.filter((app) => app.atRiskPasswordCount > 0).length,
      totalCriticalMemberCount: criticalUniqueMembers.length,
      totalCriticalAtRiskMemberCount: criticalAtRiskUniqueMembers.length,
      totalCriticalApplicationCount: criticalReports.length,
      totalCriticalAtRiskApplicationCount: criticalReports.filter(
        (app) => app.atRiskPasswordCount > 0,
      ).length,
    };
  }

  /**
   * Get information associated to the report applications that can be modified
   *
   * @param reports
   * @returns A list of applications with a critical marking flag and review date
   */
  getOrganizationApplications(
    reports: ApplicationHealthReportDetail[],
    previousApplications: OrganizationReportApplication[] = [],
  ): OrganizationReportApplication[] {
    if (previousApplications.length > 0) {
      // Preserve existing critical application markings and dates
      return reports.map((report) => {
        const existingApp = previousApplications.find(
          (app) => app.applicationName === report.applicationName,
        );
        return {
          applicationName: report.applicationName,
          isCritical: existingApp ? existingApp.isCritical : false,
          reviewedDate: existingApp ? existingApp.reviewedDate : null,
        };
      });
    }

    // No previous applications, return all as non-critical with no review date
    return reports.map(
      (report): OrganizationReportApplication => ({
        applicationName: report.applicationName,
        isCritical: false,
        reviewedDate: null,
      }),
    );
  }

  /**
   * Gets the risk insights report for a specific organization and user.
   *
   * @param organizationId
   * @param userId
   * @returns An observable that emits the decrypted risk insights report data.
   */
  getRiskInsightsReport$(
    organizationId: OrganizationId,
    userId: UserId,
  ): Observable<RiskInsightsData | null> {
    return this.riskInsightsApiService.getRiskInsightsReport$(organizationId).pipe(
      switchMap((response) => {
        if (!response) {
          // Return an empty report and summary if response is falsy
          return of(null as unknown as RiskInsightsData);
        }
        if (!response.contentEncryptionKey || response.contentEncryptionKey.data == "") {
          return throwError(() => new Error("Report key not found"));
        }
        if (!response.reportData) {
          return throwError(() => new Error("Report data not found"));
        }
        if (!response.summaryData) {
          return throwError(() => new Error("Summary data not found"));
        }
        if (!response.applicationData) {
          return throwError(() => new Error("Application data not found"));
        }

        return from(
          this.riskInsightsEncryptionService.decryptRiskInsightsReport(
            {
              organizationId,
              userId,
            },
            {
              encryptedReportData: response.reportData,
              encryptedSummaryData: response.summaryData,
              encryptedApplicationData: response.applicationData,
            },
            response.contentEncryptionKey,
          ),
        ).pipe(
          map((decryptedData) => {
            const newReport: RiskInsightsData = {
              id: response.id as OrganizationReportId,
              reportData: decryptedData.reportData,
              summaryData: decryptedData.summaryData,
              applicationData: decryptedData.applicationData,
              creationDate: response.creationDate,
              contentEncryptionKey: response.contentEncryptionKey,
            };
            return newReport;
          }),
          catchError((error: unknown) => {
            return throwError(() => error);
          }),
        );
      }),
      catchError((error: unknown) => {
        return throwError(() => error);
      }),
    );
  }

  isCriticalApplication(
    application: ApplicationHealthReportDetail,
    applicationData: OrganizationReportApplication[],
  ): boolean {
    return applicationData.some(
      (a) => a.applicationName == application.applicationName && a.isCritical,
    );
  }

  /**
   * Encrypts the risk insights report data for a specific organization.
   * @param organizationId The ID of the organization.
   * @param userId The ID of the user.
   * @param report The report data to encrypt.
   * @returns A promise that resolves to an object containing the encrypted data and encryption key.
   */
  saveRiskInsightsReport$(
    report: ApplicationHealthReportDetail[],
    summary: OrganizationReportSummary,
    applications: OrganizationReportApplication[],
    metrics: RiskInsightsMetrics,
    encryptionParameters: {
      organizationId: OrganizationId;
      userId: UserId;
    },
  ): Observable<{ response: SaveRiskInsightsReportResponse; contentEncryptionKey: EncString }> {
    return from(
      this.riskInsightsEncryptionService.encryptRiskInsightsReport(
        {
          organizationId: encryptionParameters.organizationId,
          userId: encryptionParameters.userId,
        },
        {
          reportData: report,
          summaryData: summary,
          applicationData: applications,
        },
      ),
    ).pipe(
      map(
        ({
          encryptedReportData,
          encryptedSummaryData,
          encryptedApplicationData,
          contentEncryptionKey,
        }) => ({
          requestPayload: {
            data: {
              organizationId: encryptionParameters.organizationId,
              creationDate: new Date().toISOString(),
              reportData: encryptedReportData.toSdk(),
              summaryData: encryptedSummaryData.toSdk(),
              applicationData: encryptedApplicationData.toSdk(),
              contentEncryptionKey: contentEncryptionKey.toSdk(),
              metrics: metrics.toRiskInsightsMetricsData(),
            },
          },
          // Keep the original EncString alongside the SDK payload so downstream can return the EncString type.
          contentEncryptionKey,
        }),
      ),
      switchMap(({ requestPayload, contentEncryptionKey }) =>
        this.riskInsightsApiService
          .saveRiskInsightsReport$(requestPayload, encryptionParameters.organizationId)
          .pipe(
            map((response) => ({
              response,
              contentEncryptionKey,
            })),
          ),
      ),
      catchError((error: unknown) => {
        return EMPTY;
      }),
      map((result) => {
        if (!isSaveRiskInsightsReportResponse(result.response)) {
          throw new Error("Invalid response from API");
        }
        return result;
      }),
    );
  }

  private _groupCiphersByApplication(
    cipherHealthData: CipherHealthReport[],
  ): Map<string, CipherHealthReport[]> {
    const applicationMap = new Map<string, CipherHealthReport[]>();

    cipherHealthData.forEach((cipher: CipherHealthReport) => {
      cipher.applications.forEach((application) => {
        const existingApplication = applicationMap.get(application) || [];
        existingApplication.push(cipher);
        applicationMap.set(application, existingApplication);
      });
    });

    return applicationMap;
  }

  // --------------------------- Aggregation methods ---------------------------
  /**
   * Loop through the flattened cipher to uri data. If the item exists it's values need to be updated with the new item.
   * If the item is new, create and add the object with the flattened details
   * @param cipherHealthReport Cipher and password health info broken out into their uris
   * @returns Application health reports
   */
  private _getApplicationHealthReport(
    application: string,
    ciphers: CipherHealthReport[],
  ): ApplicationHealthReportDetail {
    let aggregatedReport: ApplicationHealthReportDetail | undefined;

    ciphers.forEach((cipher) => {
      const isAtRisk = this._isPasswordAtRisk(cipher.healthData);
      aggregatedReport = this._aggregateReport(application, cipher, isAtRisk, aggregatedReport);
    });

    return aggregatedReport!;
  }

  private _aggregateReport(
    application: string,
    newCipherReport: CipherHealthReport,
    isAtRisk: boolean,
    existingReport?: ApplicationHealthReportDetail,
  ): ApplicationHealthReportDetail {
    let baseReport = existingReport
      ? this._updateExistingReport(existingReport, newCipherReport)
      : this._createNewReport(application, newCipherReport);
    if (isAtRisk) {
      baseReport = { ...baseReport, ...this._getAtRiskData(baseReport, newCipherReport) };
    }

    baseReport.memberCount = baseReport.memberDetails.length;
    baseReport.atRiskMemberCount = baseReport.atRiskMemberDetails.length;

    return baseReport;
  }
  private _createNewReport(
    application: string,
    cipherReport: CipherHealthReport,
  ): ApplicationHealthReportDetail {
    return {
      applicationName: application,
      cipherIds: [cipherReport.cipher.id],
      passwordCount: 1,
      memberDetails: [...cipherReport.cipherMembers],
      memberCount: cipherReport.cipherMembers.length,
      atRiskCipherIds: [],
      atRiskMemberCount: 0,
      atRiskMemberDetails: [],
      atRiskPasswordCount: 0,
    };
  }

  private _updateExistingReport(
    existingReport: ApplicationHealthReportDetail,
    newCipherReport: CipherHealthReport,
  ): ApplicationHealthReportDetail {
    return {
      ...existingReport,
      passwordCount: existingReport.passwordCount + 1,
      memberDetails: getUniqueMembers(
        existingReport.memberDetails.concat(newCipherReport.cipherMembers),
      ),
      cipherIds: existingReport.cipherIds.concat(newCipherReport.cipher.id),
    };
  }

  private _getAtRiskData(report: ApplicationHealthReportDetail, cipherReport: CipherHealthReport) {
    const atRiskMemberDetails = getUniqueMembers(
      report.atRiskMemberDetails.concat(cipherReport.cipherMembers),
    );
    return {
      atRiskPasswordCount: report.atRiskPasswordCount + 1,
      atRiskCipherIds: report.atRiskCipherIds.concat(cipherReport.cipher.id),
      atRiskMemberDetails,
      atRiskMemberCount: atRiskMemberDetails.length,
    };
  }

  // TODO Move to health service
  private _isPasswordAtRisk(healthData: PasswordHealthData): boolean {
    return !!(
      healthData.exposedPasswordDetail ||
      healthData.weakPasswordDetail ||
      healthData.reusedPasswordCount > 1
    );
  }
}
