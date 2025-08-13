// FIXME: Update this file to be type safe
// @ts-strict-ignore
import { from, map, switchMap, of, Observable, forkJoin } from "rxjs";

import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { flattenMemberDetails, getTrimmedCipherUris, getUniqueMembers } from "../helpers";
import { SaveRiskInsightsReportResponse } from "../models/api-models.types";
import {
  ApplicationHealthReportDetail,
  AtRiskMemberDetail,
  AtRiskApplicationDetail,
  CipherHealthReport,
  MemberDetails,
  ApplicationHealthReportSummary,
  RiskInsightsReportData,
  PasswordHealthData,
} from "../models/report-models";

import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsApiService } from "./risk-insights-api.service";
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";

export class RiskInsightsReportService {
  constructor(
    private cipherService: CipherService,
    private memberCipherDetailsApiService: MemberCipherDetailsApiService,
    private passwordHealthService: PasswordHealthService,
    private riskInsightsApiService: RiskInsightsApiService,
    private riskInsightsEncryptionService: RiskInsightsEncryptionService,
  ) {}

  /**
   * Report data for the aggregation of uris to like uris and getting password/member counts,
   * members, and at risk statuses.
   * @param organizationId Id of the organization
   * @returns The all applications health report data
   */
  generateApplicationsReport$(
    organizationId: OrganizationId,
  ): Observable<ApplicationHealthReportDetail[]> {
    const allCiphers$ = from(this.cipherService.getAllFromApiForOrganization(organizationId));
    const memberCiphers$ = from(
      this.memberCipherDetailsApiService.getMemberCipherDetails(organizationId),
    ).pipe(map((memberCiphers) => flattenMemberDetails(memberCiphers)));

    return forkJoin([allCiphers$, memberCiphers$]).pipe(
      switchMap(([ciphers, memberCiphers]) => this._getCipherDetails(ciphers, memberCiphers)),
      map((cipherApplications) => {
        const groupedByApplication = this._groupCiphersByApplication(cipherApplications);

        return Array.from(groupedByApplication.entries()).map(([application, ciphers]) =>
          this._getApplicationHealthReport(application, ciphers),
        );
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
  ): Observable<RiskInsightsReportData> {
    return this.riskInsightsApiService.getRiskInsightsReport$(organizationId).pipe(
      switchMap((response) => {
        if (!response) {
          // Return an empty report and summary if response is falsy
          return of<RiskInsightsReportData>({
            data: [],
            summary: {
              totalMemberCount: 0,
              totalAtRiskMemberCount: 0,
              totalApplicationCount: 0,
              totalAtRiskApplicationCount: 0,
            },
          });
        }
        if (!response.contentEncryptionKey || response.contentEncryptionKey == "") {
          throw new Error("Report key not found");
        }
        return from(
          this.riskInsightsEncryptionService.decryptRiskInsightsReport<RiskInsightsReportData>(
            organizationId,
            userId,
            new EncString(response.reportData),
            new EncString(response.contentEncryptionKey),
            (data) => data as RiskInsightsReportData,
          ),
        );
      }),
    );
  }

  /**
   * Encrypts the risk insights report data for a specific organization.
   * @param organizationId The ID of the organization.
   * @param userId The ID of the user.
   * @param report The report data to encrypt.
   * @returns A promise that resolves to an object containing the encrypted data and encryption key.
   */
  saveReport$(
    report: ApplicationHealthReportDetail[],
    summary: ApplicationHealthReportSummary,
    encryptionParameters: {
      organizationId: OrganizationId;
      userId: UserId;
    },
  ): Observable<SaveRiskInsightsReportResponse> {
    return from(
      this.riskInsightsEncryptionService.encryptRiskInsightsReport(
        encryptionParameters.organizationId,
        encryptionParameters.userId,
        {
          data: report,
          summary: summary,
        },
      ),
    ).pipe(
      map((encryptedReport) => ({
        data: {
          organizationId: encryptionParameters.organizationId,
          date: new Date().toISOString(),
          reportData: encryptedReport.encryptedData,
          reportKey: encryptedReport.contentEncryptionKey,
        },
      })),
      switchMap((encryptedReport) =>
        this.riskInsightsApiService.saveRiskInsightsReport$(encryptedReport),
      ),
    );
  }

  /**
   * Gets the summary from the application health report. Returns total members and applications as well
   * as the total at risk members and at risk applications
   * @param reports The previously calculated application health report data
   * @returns A summary object containing report totals
   */
  generateApplicationsSummary(
    reports: ApplicationHealthReportDetail[],
  ): ApplicationHealthReportSummary {
    const totalMembers = reports.flatMap((x) => x.memberDetails);
    const uniqueMembers = getUniqueMembers(totalMembers);

    const atRiskMembers = reports.flatMap((x) => x.atRiskMemberDetails);
    const uniqueAtRiskMembers = getUniqueMembers(atRiskMembers);

    return {
      totalMemberCount: uniqueMembers.length,
      totalAtRiskMemberCount: uniqueAtRiskMembers.length,
      totalApplicationCount: reports.length,
      totalAtRiskApplicationCount: reports.filter((app) => app.atRiskPasswordCount > 0).length,
    };
  }

  /**
   * Generates a list of members with at-risk passwords along with the number of at-risk passwords.
   */
  generateAtRiskMemberList(
    cipherHealthReportDetails: ApplicationHealthReportDetail[],
  ): AtRiskMemberDetail[] {
    const memberRiskMap = new Map<string, number>();

    cipherHealthReportDetails.forEach((app) => {
      app.atRiskMemberDetails.forEach((member) => {
        if (memberRiskMap.has(member.email)) {
          memberRiskMap.set(member.email, memberRiskMap.get(member.email) + 1);
        } else {
          memberRiskMap.set(member.email, 1);
        }
      });
    });

    return Array.from(memberRiskMap.entries()).map(([email, atRiskPasswordCount]) => ({
      email,
      atRiskPasswordCount,
    }));
  }

  generateAtRiskApplicationList(
    cipherHealthReportDetails: ApplicationHealthReportDetail[],
  ): AtRiskApplicationDetail[] {
    const appsRiskMap = new Map<string, number>();

    cipherHealthReportDetails
      .filter((app) => app.atRiskPasswordCount > 0)
      .forEach((app) => {
        if (appsRiskMap.has(app.applicationName)) {
          appsRiskMap.set(
            app.applicationName,
            appsRiskMap.get(app.applicationName) + app.atRiskPasswordCount,
          );
        } else {
          appsRiskMap.set(app.applicationName, app.atRiskPasswordCount);
        }
      });

    return Array.from(appsRiskMap.entries()).map(([applicationName, atRiskPasswordCount]) => ({
      applicationName,
      atRiskPasswordCount,
    }));
  }

  async getApplicationCipherMap(
    applications: ApplicationHealthReportDetail[],
    organizationId: OrganizationId,
  ): Promise<Map<string, CipherView[]>> {
    const allCiphers = await this.cipherService.getAllFromApiForOrganization(organizationId);
    const cipherMap = new Map<string, CipherView[]>();

    applications.forEach((app) => {
      const filteredCiphers = allCiphers.filter((c) => app.cipherIds.includes(c.id));
      cipherMap.set(app.applicationName, filteredCiphers);
    });
    return cipherMap;
  }

  private _buildPasswordUseMap(ciphers: CipherView[]): Map<string, number> {
    const passwordUseMap = new Map<string, number>();
    ciphers.forEach((cipher) => {
      const password = cipher.login.password;
      passwordUseMap.set(password, (passwordUseMap.get(password) || 0) + 1);
    });
    return passwordUseMap;
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

  private _isPasswordAtRisk(healthData: PasswordHealthData): boolean {
    return !!(
      healthData.exposedPasswordDetail ||
      healthData.weakPasswordDetail ||
      healthData.reusedPasswordCount > 1
    );
  }

  /**
   * Associates the members with the ciphers they have access to. Calculates the password health.
   * Finds the trimmed uris.
   * @param ciphers Org ciphers
   * @param memberDetails Org members
   * @returns Cipher password health data with trimmed uris and associated members
   */
  private _getCipherDetails(
    ciphers: CipherView[],
    memberDetails: MemberDetails[],
  ): Observable<CipherHealthReport[]> {
    const validCiphers = ciphers.filter((cipher) =>
      this.passwordHealthService.isValidCipher(cipher),
    );
    // Build password use map
    const passwordUseMap = this._buildPasswordUseMap(validCiphers);

    return this.passwordHealthService.auditPasswordLeaks$(validCiphers).pipe(
      map((exposedDetails) => {
        return validCiphers.map((cipher) => {
          const exposedPassword = exposedDetails.find((x) => x.cipherId === cipher.id);
          const cipherMembers = memberDetails.filter((x) => x.cipherId === cipher.id);

          const result = {
            cipher: cipher,
            cipherMembers,
            healthData: {
              weakPasswordDetail: this.passwordHealthService.findWeakPasswordDetails(cipher),
              exposedPasswordDetail: exposedPassword,
              reusedPasswordCount: passwordUseMap.get(cipher.login.password) ?? 0,
            },
            applications: getTrimmedCipherUris(cipher),
          } as CipherHealthReport;
          return result;
        });
      }),
    );
  }
}
