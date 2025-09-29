import {
  BehaviorSubject,
  catchError,
  concatMap,
  EMPTY,
  first,
  firstValueFrom,
  forkJoin,
  from,
  map,
  Observable,
  of,
  switchMap,
  throwError,
  zip,
} from "rxjs";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  createNewReportData,
  createNewSummaryData,
  flattenMemberDetails,
  getApplicationReportDetail,
  getFlattenedCipherDetails,
  getMemberDetailsFlat,
  getTrimmedCipherUris,
  getUniqueMembers,
} from "../helpers/risk-insights-data-mappers";
import {
  isSaveRiskInsightsReportResponse,
  SaveRiskInsightsReportResponse,
} from "../models/api-models.types";
import {
  LEGACY_CipherHealthReportDetail,
  LEGACY_CipherHealthReportUriDetail,
  LEGACY_MemberDetailsFlat,
  LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher,
} from "../models/password-health";
import {
  ApplicationHealthReportDetail,
  OrganizationReportSummary,
  AtRiskApplicationDetail,
  AtRiskMemberDetail,
  CipherHealthReport,
  MemberDetails,
  PasswordHealthData,
  OrganizationReportApplication,
  RiskInsightsData,
} from "../models/report-models";

import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsApiService } from "./risk-insights-api.service";
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";

export class RiskInsightsReportService {
  private riskInsightsReportSubject = new BehaviorSubject<ApplicationHealthReportDetail[]>([]);
  riskInsightsReport$ = this.riskInsightsReportSubject.asObservable();

  private riskInsightsSummarySubject = new BehaviorSubject<OrganizationReportSummary>(
    createNewSummaryData(),
  );
  riskInsightsSummary$ = this.riskInsightsSummarySubject.asObservable();

  // [FIXME] CipherData
  // Cipher data
  // private _ciphersSubject = new BehaviorSubject<CipherView[] | null>(null);
  // _ciphers$ = this._ciphersSubject.asObservable();

  constructor(
    private cipherService: CipherService,
    private memberCipherDetailsApiService: MemberCipherDetailsApiService,
    private passwordHealthService: PasswordHealthService,
    private riskInsightsApiService: RiskInsightsApiService,
    private riskInsightsEncryptionService: RiskInsightsEncryptionService,
  ) {}

  // [FIXME] CipherData
  // async loadCiphersForOrganization(organizationId: OrganizationId): Promise<void> {
  //   await this.cipherService.getAllFromApiForOrganization(organizationId).then((ciphers) => {
  //     this._ciphersSubject.next(ciphers);
  //   });
  // }

  /**
   * Report data from raw cipher health data.
   * Can be used in the Raw Data diagnostic tab (just exclude the members in the view)
   * and can be used in the raw data + members tab when including the members in the view
   * @param organizationId
   * @returns Cipher health report data with members and trimmed uris
   */
  LEGACY_generateRawDataReport$(
    organizationId: OrganizationId,
  ): Observable<LEGACY_CipherHealthReportDetail[]> {
    const allCiphers$ = from(this.cipherService.getAllFromApiForOrganization(organizationId));
    const memberCiphers$ = from(
      this.memberCipherDetailsApiService.getMemberCipherDetails(organizationId),
    );

    const results$ = zip(allCiphers$, memberCiphers$).pipe(
      map(([allCiphers, memberCiphers]) => {
        const details: LEGACY_MemberDetailsFlat[] = memberCiphers.flatMap((dtl) =>
          dtl.cipherIds.map((c) => getMemberDetailsFlat(dtl.userGuid, dtl.userName, dtl.email, c)),
        );
        return [allCiphers, details] as const;
      }),
      concatMap(([ciphers, flattenedDetails]) =>
        this.LEGACY_getCipherDetails(ciphers, flattenedDetails),
      ),
      first(),
    );

    return results$;
  }

  /**
   * Report data for raw cipher health broken out into the uris
   * Can be used in the raw data + members + uri diagnostic report
   * @param organizationId Id of the organization
   * @returns Cipher health report data flattened to the uris
   */
  generateRawDataUriReport$(
    organizationId: OrganizationId,
  ): Observable<LEGACY_CipherHealthReportUriDetail[]> {
    const cipherHealthDetails$ = this.LEGACY_generateRawDataReport$(organizationId);
    const results$ = cipherHealthDetails$.pipe(
      map((healthDetails) => this.getCipherUriDetails(healthDetails)),
      first(),
    );

    return results$;
  }

  /**
   * Report data for the aggregation of uris to like uris and getting password/member counts,
   * members, and at risk statuses.
   * @param organizationId Id of the organization
   * @returns The all applications health report data
   */
  LEGACY_generateApplicationsReport$(
    organizationId: OrganizationId,
  ): Observable<ApplicationHealthReportDetail[]> {
    const cipherHealthUriReport$ = this.generateRawDataUriReport$(organizationId);
    const results$ = cipherHealthUriReport$.pipe(
      map((uriDetails) => this.LEGACY_getApplicationHealthReport(uriDetails)),
      first(),
    );

    return results$;
  }

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
   * Generates a list of members with at-risk passwords along with the number of at-risk passwords.
   */
  generateAtRiskMemberList(
    cipherHealthReportDetails: ApplicationHealthReportDetail[],
  ): AtRiskMemberDetail[] {
    const memberRiskMap = new Map<string, number>();

    cipherHealthReportDetails.forEach((app) => {
      app.atRiskMemberDetails.forEach((member) => {
        const currentCount = memberRiskMap.get(member.email) ?? 0;
        memberRiskMap.set(member.email, currentCount + 1);
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
    const applicationPasswordRiskMap = new Map<string, number>();

    cipherHealthReportDetails
      .filter((app) => app.atRiskPasswordCount > 0)
      .forEach((app) => {
        const atRiskPasswordCount = applicationPasswordRiskMap.get(app.applicationName) ?? 0;
        applicationPasswordRiskMap.set(
          app.applicationName,
          atRiskPasswordCount + app.atRiskPasswordCount,
        );
      });

    return Array.from(applicationPasswordRiskMap.entries()).map(
      ([applicationName, atRiskPasswordCount]) => ({
        applicationName,
        atRiskPasswordCount,
      }),
    );
  }

  /**
   * Gets the summary from the application health report. Returns total members and applications as well
   * as the total at risk members and at risk applications
   * @param reports The previously calculated application health report data
   * @returns A summary object containing report totals
   */
  generateApplicationsSummary(reports: ApplicationHealthReportDetail[]): OrganizationReportSummary {
    const totalMembers = reports.flatMap((x) => x.memberDetails);
    const uniqueMembers = getUniqueMembers(totalMembers);

    const atRiskMembers = reports.flatMap((x) => x.atRiskMemberDetails);
    const uniqueAtRiskMembers = getUniqueMembers(atRiskMembers);

    // TODO: totalCriticalMemberCount, totalCriticalAtRiskMemberCount, totalCriticalApplicationCount, totalCriticalAtRiskApplicationCount, and newApplications will be handled with future logic implementation
    return {
      totalMemberCount: uniqueMembers.length,
      totalCriticalMemberCount: 0,
      totalAtRiskMemberCount: uniqueAtRiskMembers.length,
      totalCriticalAtRiskMemberCount: 0,
      totalApplicationCount: reports.length,
      totalCriticalApplicationCount: 0,
      totalAtRiskApplicationCount: reports.filter((app) => app.atRiskPasswordCount > 0).length,
      totalCriticalAtRiskApplicationCount: 0,
      newApplications: [],
    };
  }

  /**
   * Generate a snapshot of applications and related data associated to this report
   *
   * @param reports
   * @returns A list of applications with a critical marking flag
   */
  generateOrganizationApplications(
    reports: ApplicationHealthReportDetail[],
  ): OrganizationReportApplication[] {
    return reports.map((report) => ({
      applicationName: report.applicationName,
      isCritical: false,
    }));
  }

  async identifyCiphers(
    data: ApplicationHealthReportDetail[],
    organizationId: OrganizationId,
  ): Promise<LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher[]> {
    const cipherViews = await this.cipherService.getAllFromApiForOrganization(organizationId);

    const dataWithCiphers = data.map(
      (app, index) =>
        ({
          ...app,
          ciphers: cipherViews.filter((c) => app.cipherIds.some((a) => a === c.id)),
        }) as LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher,
    );
    return dataWithCiphers;
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
  ): Observable<RiskInsightsData> {
    return this.riskInsightsApiService.getRiskInsightsReport$(organizationId).pipe(
      switchMap((response) => {
        if (!response) {
          // Return an empty report and summary if response is falsy
          return of<RiskInsightsData>(createNewReportData());
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
          map((decryptedData) => ({
            reportData: decryptedData.reportData,
            summaryData: decryptedData.summaryData,
            applicationData: decryptedData.applicationData,
            creationDate: response.creationDate,
          })),
          catchError((error: unknown) => {
            // TODO Handle errors appropriately
            // console.error("An error occurred when decrypting report", error);
            return EMPTY;
          }),
        );
      }),
      catchError((error: unknown) => {
        // console.error("An error occurred when fetching the last report", error);
        return EMPTY;
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
  saveRiskInsightsReport$(
    report: ApplicationHealthReportDetail[],
    summary: OrganizationReportSummary,
    applications: OrganizationReportApplication[],
    encryptionParameters: {
      organizationId: OrganizationId;
      userId: UserId;
    },
  ): Observable<SaveRiskInsightsReportResponse> {
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
          data: {
            organizationId: encryptionParameters.organizationId,
            creationDate: new Date().toISOString(),
            reportData: encryptedReportData.toSdk(),
            summaryData: encryptedSummaryData.toSdk(),
            applicationData: encryptedApplicationData.toSdk(),
            contentEncryptionKey: contentEncryptionKey.toSdk(),
          },
        }),
      ),
      switchMap((encryptedReport) =>
        this.riskInsightsApiService.saveRiskInsightsReport$(
          encryptedReport,
          encryptionParameters.organizationId,
        ),
      ),
      catchError((error: unknown) => {
        return EMPTY;
      }),
      map((response) => {
        if (!isSaveRiskInsightsReportResponse(response)) {
          throw new Error("Invalid response from API");
        }
        return response;
      }),
    );
  }

  /**
   * Associates the members with the ciphers they have access to. Calculates the password health.
   * Finds the trimmed uris.
   * @param ciphers Org ciphers
   * @param memberDetails Org members
   * @returns Cipher password health data with trimmed uris and associated members
   */
  private async LEGACY_getCipherDetails(
    ciphers: CipherView[],
    memberDetails: LEGACY_MemberDetailsFlat[],
  ): Promise<LEGACY_CipherHealthReportDetail[]> {
    const cipherHealthReports: LEGACY_CipherHealthReportDetail[] = [];
    const passwordUseMap = new Map<string, number>();
    const exposedDetails = await firstValueFrom(
      this.passwordHealthService.auditPasswordLeaks$(ciphers),
    );
    for (const cipher of ciphers) {
      if (this.passwordHealthService.isValidCipher(cipher)) {
        const weakPassword = this.passwordHealthService.findWeakPasswordDetails(cipher);
        // Looping over all ciphers needs to happen first to determine reused passwords over all ciphers.
        // Store in the set and evaluate later
        if (passwordUseMap.has(cipher.login.password)) {
          passwordUseMap.set(
            cipher.login.password,
            (passwordUseMap.get(cipher.login.password) || 0) + 1,
          );
        } else {
          passwordUseMap.set(cipher.login.password, 1);
        }

        const exposedPassword = exposedDetails.find((x) => x?.cipherId === cipher.id);

        // Get the cipher members
        const cipherMembers = memberDetails.filter((x) => x.cipherId === cipher.id);

        // Trim uris to host name and create the cipher health report
        const cipherTrimmedUris = getTrimmedCipherUris(cipher);
        const cipherHealth = {
          ...cipher,
          weakPasswordDetail: weakPassword,
          exposedPasswordDetail: exposedPassword,
          cipherMembers: cipherMembers,
          trimmedUris: cipherTrimmedUris,
        } as LEGACY_CipherHealthReportDetail;

        cipherHealthReports.push(cipherHealth);
      }
    }

    // loop for reused passwords
    cipherHealthReports.forEach((detail) => {
      detail.reusedPasswordCount = passwordUseMap.get(detail.login.password) ?? 0;
    });
    return cipherHealthReports;
  }

  /**
   * Flattens the cipher to trimmed uris. Used for the raw data + uri
   * @param cipherHealthReport Cipher health report with uris and members
   * @returns Flattened cipher health details to uri
   */
  private getCipherUriDetails(
    cipherHealthReport: LEGACY_CipherHealthReportDetail[],
  ): LEGACY_CipherHealthReportUriDetail[] {
    return cipherHealthReport.flatMap((rpt) =>
      rpt.trimmedUris.map((u) => getFlattenedCipherDetails(rpt, u)),
    );
  }

  /**
   * Loop through the flattened cipher to uri data. If the item exists it's values need to be updated with the new item.
   * If the item is new, create and add the object with the flattened details
   * @param cipherHealthUriReport Cipher and password health info broken out into their uris
   * @returns Application health reports
   */
  private LEGACY_getApplicationHealthReport(
    cipherHealthUriReport: LEGACY_CipherHealthReportUriDetail[],
  ): ApplicationHealthReportDetail[] {
    const appReports: ApplicationHealthReportDetail[] = [];
    cipherHealthUriReport.forEach((uri) => {
      const index = appReports.findIndex((item) => item.applicationName === uri.trimmedUri);

      let atRisk: boolean = false;
      if (uri.exposedPasswordDetail || uri.weakPasswordDetail || uri.reusedPasswordCount > 1) {
        atRisk = true;
      }

      if (index === -1) {
        appReports.push(getApplicationReportDetail(uri, atRisk));
      } else {
        appReports[index] = getApplicationReportDetail(uri, atRisk, appReports[index]);
      }
    });
    return appReports;
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
   *
   * @param applications The list of application health report details to map ciphers to
   * @param organizationId
   * @returns
   */
  async getApplicationCipherMap(
    applications: ApplicationHealthReportDetail[],
    organizationId: OrganizationId,
  ): Promise<Map<string, CipherView[]>> {
    // [FIXME] CipherData
    // This call is made multiple times. We can optimize this
    // by loading the ciphers once via a load method to avoid multiple API calls
    // for the same organization
    const allCiphers = await this.cipherService.getAllFromApiForOrganization(organizationId);
    const cipherMap = new Map<string, CipherView[]>();

    applications.forEach((app) => {
      const filteredCiphers = allCiphers.filter((c) => app.cipherIds.includes(c.id));
      cipherMap.set(app.applicationName, filteredCiphers);
    });
    return cipherMap;
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
          const exposedPassword = exposedDetails.find((x) => x?.cipherId === cipher.id);
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
