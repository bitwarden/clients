// FIXME: Update this file to be type safe
// @ts-strict-ignore
import { concatMap, first, from, map, Observable, zip } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  ApplicationHealthReportDetail,
  ApplicationHealthReportSummary,
  AtRiskMemberDetail,
  AtRiskApplicationDetail,
  CipherHealthReportDetail,
  CipherHealthReportUriDetail,
  ExposedPasswordDetail,
  MemberDetailsFlat,
  WeakPasswordDetail,
  WeakPasswordScore,
} from "../models/password-health";

import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";

export class RiskInsightsReportService {
  constructor(
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private auditService: AuditService,
    private cipherService: CipherService,
    private memberCipherDetailsApiService: MemberCipherDetailsApiService,
  ) {}

  /**
   * Report data from raw cipher health data.
   * Can be used in the Raw Data diagnostic tab (just exclude the members in the view)
   * and can be used in the raw data + members tab when including the members in the view
   * @param organizationId
   * @returns Cipher health report data with members and trimmed uris
   */
  generateRawDataReport$(organizationId: string): Observable<CipherHealthReportDetail[]> {
    const allCiphers$ = from(this.cipherService.getAllFromApiForOrganization(organizationId));
    const memberCiphers$ = from(
      this.memberCipherDetailsApiService.getMemberCipherDetails(organizationId),
    );

    const results$ = zip(allCiphers$, memberCiphers$).pipe(
      map(([allCiphers, memberCiphers]) => {
        const details: MemberDetailsFlat[] = memberCiphers.flatMap((dtl) =>
          dtl.cipherIds.map((c) => this.getMemberDetailsFlat(dtl.userName, dtl.email, c)),
        );
        return [allCiphers, details] as const;
      }),
      concatMap(([ciphers, flattenedDetails]) => this.getCipherDetails(ciphers, flattenedDetails)),
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
  generateRawDataUriReport$(organizationId: string): Observable<CipherHealthReportUriDetail[]> {
    const cipherHealthDetails$ = this.generateRawDataReport$(organizationId);
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
  generateApplicationsReport$(organizationId: string): Observable<ApplicationHealthReportDetail[]> {
    const cipherHealthUriReport$ = this.generateRawDataUriReport$(organizationId);
    const results$ = cipherHealthUriReport$.pipe(
      map((uriDetails) => this.getApplicationHealthReport(uriDetails)),
      first(),
    );

    return results$;
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
    const uniqueMembers = this.getUniqueMembers(totalMembers);

    const atRiskMembers = reports.flatMap((x) => x.atRiskMemberDetails);
    const uniqueAtRiskMembers = this.getUniqueMembers(atRiskMembers);

    return {
      totalMemberCount: uniqueMembers.length,
      totalAtRiskMemberCount: uniqueAtRiskMembers.length,
      totalApplicationCount: reports.length,
      totalAtRiskApplicationCount: reports.filter((app) => app.atRiskPasswordCount > 0).length,
    };
  }

  /**
   * Associates the members with the ciphers they have access to. Calculates the password health.
   * Finds the trimmed uris.
   * @param ciphers Org ciphers
   * @param memberDetails Org members
   * @returns Cipher password health data with trimmed uris and associated members
   */
  private async getCipherDetails(
    ciphers: CipherView[],
    memberDetails: MemberDetailsFlat[],
  ): Promise<CipherHealthReportDetail[]> {
    const cipherHealthReports: CipherHealthReportDetail[] = [];
    const passwordUseMap = new Map<string, number>();
    const exposedDetails = await this.findExposedPasswords(ciphers);
    for (const cipher of ciphers) {
      if (this.validateCipher(cipher)) {
        const weakPassword = this.findWeakPassword(cipher);
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

        const exposedPassword = exposedDetails.find((x) => x.cipherId === cipher.id);

        // Get the cipher members
        const cipherMembers = memberDetails.filter((x) => x.cipherId === cipher.id);

        // Trim uris to host name and create the cipher health report
        const cipherTrimmedUris = this.getTrimmedCipherUris(cipher);
        const cipherHealth = {
          ...cipher,
          weakPasswordDetail: weakPassword,
          exposedPasswordDetail: exposedPassword,
          cipherMembers: cipherMembers,
          trimmedUris: cipherTrimmedUris,
        } as CipherHealthReportDetail;

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
    cipherHealthReport: CipherHealthReportDetail[],
  ): CipherHealthReportUriDetail[] {
    return cipherHealthReport.flatMap((rpt) =>
      rpt.trimmedUris.map((u) => this.getFlattenedCipherDetails(rpt, u)),
    );
  }

  /**
   * Loop through the flattened cipher to uri data. If the item exists it's values need to be updated with the new item.
   * If the item is new, create and add the object with the flattened details
   * @param cipherHealthUriReport Cipher and password health info broken out into their uris
   * @returns Application health reports
   */
  private getApplicationHealthReport(
    cipherHealthUriReport: CipherHealthReportUriDetail[],
  ): ApplicationHealthReportDetail[] {
    const appReports: ApplicationHealthReportDetail[] = [];
    cipherHealthUriReport.forEach((uri) => {
      const index = appReports.findIndex((item) => item.applicationName === uri.trimmedUri);

      let atRisk: boolean = false;
      if (uri.exposedPasswordDetail || uri.weakPasswordDetail || uri.reusedPasswordCount > 1) {
        atRisk = true;
      }

      if (index === -1) {
        appReports.push(this.getApplicationReportDetail(uri, atRisk));
      } else {
        appReports[index] = this.getApplicationReportDetail(uri, atRisk, appReports[index]);
      }
    });
    return appReports;
  }

  private async findExposedPasswords(ciphers: CipherView[]): Promise<ExposedPasswordDetail[]> {
    const exposedDetails: ExposedPasswordDetail[] = [];
    const promises: Promise<void>[] = [];

    ciphers.forEach((ciph) => {
      if (this.validateCipher(ciph)) {
        const promise = this.auditService
          .passwordLeaked(ciph.login.password)
          .then((exposedCount) => {
            if (exposedCount > 0) {
              const detail = {
                exposedXTimes: exposedCount,
                cipherId: ciph.id,
              } as ExposedPasswordDetail;
              exposedDetails.push(detail);
            }
          });
        promises.push(promise);
      }
    });
    await Promise.all(promises);

    return exposedDetails;
  }

  private findWeakPassword(cipher: CipherView): WeakPasswordDetail {
    const hasUserName = this.isUserNameNotEmpty(cipher);
    let userInput: string[] = [];
    if (hasUserName) {
      const atPosition = cipher.login.username.indexOf("@");
      if (atPosition > -1) {
        userInput = userInput
          .concat(
            cipher.login.username
              .substring(0, atPosition)
              .trim()
              .toLowerCase()
              .split(/[^A-Za-z0-9]/),
          )
          .filter((i) => i.length >= 3);
      } else {
        userInput = cipher.login.username
          .trim()
          .toLowerCase()
          .split(/[^A-Za-z0-9]/)
          .filter((i) => i.length >= 3);
      }
    }
    const { score } = this.passwordStrengthService.getPasswordStrength(
      cipher.login.password,
      null,
      userInput.length > 0 ? userInput : null,
    );

    if (score != null && score <= 2) {
      const scoreValue = this.weakPasswordScore(score);
      const weakPasswordDetail = { score: score, detailValue: scoreValue } as WeakPasswordDetail;
      return weakPasswordDetail;
    }
    return null;
  }

  private weakPasswordScore(score: number): WeakPasswordScore {
    switch (score) {
      case 4:
        return { label: "strong", badgeVariant: "success" };
      case 3:
        return { label: "good", badgeVariant: "primary" };
      case 2:
        return { label: "weak", badgeVariant: "warning" };
      default:
        return { label: "veryWeak", badgeVariant: "danger" };
    }
  }

  /**
   * Create the new application health report detail object with the details from the cipher health report uri detail object
   * update or create the at risk values if the item is at risk.
   * @param newUriDetail New cipher uri detail
   * @param isAtRisk If the cipher has a weak, exposed, or reused password it is at risk
   * @param existingUriDetail The previously processed Uri item
   * @returns The new or updated application health report detail
   */
  private getApplicationReportDetail(
    newUriDetail: CipherHealthReportUriDetail,
    isAtRisk: boolean,
    existingUriDetail?: ApplicationHealthReportDetail,
  ): ApplicationHealthReportDetail {
    const reportDetail = {
      applicationName: existingUriDetail
        ? existingUriDetail.applicationName
        : newUriDetail.trimmedUri,
      passwordCount: existingUriDetail ? existingUriDetail.passwordCount + 1 : 1,
      memberDetails: existingUriDetail
        ? this.getUniqueMembers(existingUriDetail.memberDetails.concat(newUriDetail.cipherMembers))
        : newUriDetail.cipherMembers,
      atRiskMemberDetails: existingUriDetail ? existingUriDetail.atRiskMemberDetails : [],
      atRiskPasswordCount: existingUriDetail ? existingUriDetail.atRiskPasswordCount : 0,
      atRiskMemberCount: existingUriDetail ? existingUriDetail.atRiskMemberDetails.length : 0,
    } as ApplicationHealthReportDetail;

    if (isAtRisk) {
      reportDetail.atRiskPasswordCount = reportDetail.atRiskPasswordCount + 1;
      reportDetail.atRiskMemberDetails = this.getUniqueMembers(
        reportDetail.atRiskMemberDetails.concat(newUriDetail.cipherMembers),
      );
      reportDetail.atRiskMemberCount = reportDetail.atRiskMemberDetails.length;
    }

    reportDetail.memberCount = reportDetail.memberDetails.length;

    return reportDetail;
  }

  /**
   * Get a distinct array of members from a combined list. Input list may contain
   * duplicate members.
   * @param orgMembers Input list of members
   * @returns Distinct array of members
   */
  private getUniqueMembers(orgMembers: MemberDetailsFlat[]): MemberDetailsFlat[] {
    const existingEmails = new Set<string>();
    const distinctUsers = orgMembers.filter((member) => {
      if (existingEmails.has(member.email)) {
        return false;
      }
      existingEmails.add(member.email);
      return true;
    });
    return distinctUsers;
  }

  private getFlattenedCipherDetails(
    detail: CipherHealthReportDetail,
    uri: string,
  ): CipherHealthReportUriDetail {
    return {
      cipherId: detail.id,
      reusedPasswordCount: detail.reusedPasswordCount,
      weakPasswordDetail: detail.weakPasswordDetail,
      exposedPasswordDetail: detail.exposedPasswordDetail,
      cipherMembers: detail.cipherMembers,
      trimmedUri: uri,
    };
  }

  private getMemberDetailsFlat(
    userName: string,
    email: string,
    cipherId: string,
  ): MemberDetailsFlat {
    return {
      userName: userName,
      email: email,
      cipherId: cipherId,
    };
  }

  /**
   * Trim the cipher uris down to get the password health application.
   * The uri should only exist once after being trimmed. No duplication.
   * Example:
   *   - Untrimmed Uris: https://gmail.com, gmail.com/login
   *   - Both would trim to gmail.com
   *   - The cipher trimmed uri list should only return on instance in the list
   * @param cipher
   * @returns distinct list of trimmed cipher uris
   */
  private getTrimmedCipherUris(cipher: CipherView): string[] {
    const cipherUris: string[] = [];
    const uris = cipher.login?.uris ?? [];
    uris.map((u: { uri: string }) => {
      const uri = Utils.getHostname(u.uri).replace("www.", "");
      if (!cipherUris.includes(uri)) {
        cipherUris.push(uri);
      }
    });
    return cipherUris;
  }

  private isUserNameNotEmpty(c: CipherView): boolean {
    return !Utils.isNullOrWhitespace(c.login.username);
  }

  /**
   * Validates that the cipher is a login item, has a password
   * is not deleted, and the user can view the password
   * @param c the input cipher
   */
  private validateCipher(c: CipherView): boolean {
    const { type, login, isDeleted, viewPassword } = c;
    if (
      type !== CipherType.Login ||
      login.password == null ||
      login.password === "" ||
      isDeleted ||
      !viewPassword
    ) {
      return false;
    }
    return true;
  }
}
