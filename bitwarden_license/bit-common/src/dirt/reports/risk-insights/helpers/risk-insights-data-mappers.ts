import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  LEGACY_MemberDetailsFlat,
  LEGACY_CipherHealthReportDetail,
  LEGACY_CipherHealthReportUriDetail,
} from "../models/password-health";
import {
  ApplicationHealthReportDetail,
  OrganizationReportSummary,
  RiskInsightsData,
} from "../models/report-models";
import { MemberCipherDetailsResponse } from "../response/member-cipher-details.response";

export function flattenMemberDetails(
  memberCiphers: MemberCipherDetailsResponse[],
): LEGACY_MemberDetailsFlat[] {
  return memberCiphers.flatMap((member) =>
    member.cipherIds.map((cipherId) => ({
      userGuid: member.userGuid,
      userName: member.userName,
      email: member.email,
      cipherId,
    })),
  );
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
export function getTrimmedCipherUris(cipher: CipherView): string[] {
  const uris = cipher.login?.uris ?? [];

  const uniqueDomains = new Set<string>();

  uris.forEach((u: { uri: string }) => {
    const domain = Utils.getDomain(u.uri) ?? u.uri;
    uniqueDomains.add(domain);
  });
  return Array.from(uniqueDomains);
}

// Returns a deduplicated array of members by email
export function getUniqueMembers(
  orgMembers: LEGACY_MemberDetailsFlat[],
): LEGACY_MemberDetailsFlat[] {
  const existingEmails = new Set<string>();
  return orgMembers.filter((member) => {
    if (existingEmails.has(member.email)) {
      return false;
    }
    existingEmails.add(member.email);
    return true;
  });
}

/**
 * Creates a flattened member details object
 * @param userGuid User GUID
 * @param userName User name
 * @param email User email
 * @param cipherId Cipher ID
 * @returns Flattened member details
 */
export function getMemberDetailsFlat(
  userGuid: string,
  userName: string,
  email: string,
  cipherId: string,
): LEGACY_MemberDetailsFlat {
  return {
    userGuid: userGuid,
    userName: userName,
    email: email,
    cipherId: cipherId,
  };
}

/**
 * Creates a flattened cipher details object for URI reporting
 * @param detail Cipher health report detail
 * @param uri Trimmed URI
 * @returns Flattened cipher health details to URI
 */
export function getFlattenedCipherDetails(
  detail: LEGACY_CipherHealthReportDetail,
  uri: string,
): LEGACY_CipherHealthReportUriDetail {
  return {
    cipherId: detail.id,
    reusedPasswordCount: detail.reusedPasswordCount,
    weakPasswordDetail: detail.weakPasswordDetail,
    exposedPasswordDetail: detail.exposedPasswordDetail,
    cipherMembers: detail.cipherMembers,
    trimmedUri: uri,
    cipher: detail as CipherView,
  };
}

/**
 * Create the new application health report detail object with the details from the cipher health report uri detail object
 * update or create the at risk values if the item is at risk.
 * @param newUriDetail New cipher uri detail
 * @param isAtRisk If the cipher has a weak, exposed, or reused password it is at risk
 * @param existingUriDetail The previously processed Uri item
 * @returns The new or updated application health report detail
 */
export function getApplicationReportDetail(
  newUriDetail: LEGACY_CipherHealthReportUriDetail,
  isAtRisk: boolean,
  existingUriDetail?: ApplicationHealthReportDetail,
): ApplicationHealthReportDetail {
  const reportDetail = {
    applicationName: existingUriDetail
      ? existingUriDetail.applicationName
      : newUriDetail.trimmedUri,
    passwordCount: existingUriDetail ? existingUriDetail.passwordCount + 1 : 1,
    memberDetails: existingUriDetail
      ? getUniqueMembers(existingUriDetail.memberDetails.concat(newUriDetail.cipherMembers))
      : newUriDetail.cipherMembers,
    atRiskMemberDetails: existingUriDetail ? existingUriDetail.atRiskMemberDetails : [],
    atRiskPasswordCount: existingUriDetail ? existingUriDetail.atRiskPasswordCount : 0,
    atRiskCipherIds: existingUriDetail ? existingUriDetail.atRiskCipherIds : [],
    atRiskMemberCount: existingUriDetail ? existingUriDetail.atRiskMemberDetails.length : 0,
    cipherIds: existingUriDetail
      ? existingUriDetail.cipherIds.concat(newUriDetail.cipherId)
      : [newUriDetail.cipherId],
  } as ApplicationHealthReportDetail;

  if (isAtRisk) {
    reportDetail.atRiskPasswordCount = reportDetail.atRiskPasswordCount + 1;
    reportDetail.atRiskCipherIds.push(newUriDetail.cipherId);

    reportDetail.atRiskMemberDetails = getUniqueMembers(
      reportDetail.atRiskMemberDetails.concat(newUriDetail.cipherMembers),
    );
    reportDetail.atRiskMemberCount = reportDetail.atRiskMemberDetails.length;
  }

  reportDetail.memberCount = reportDetail.memberDetails.length;

  return reportDetail;
}

/**
 * Create a new Risk Insights Report
 *
 * @returns An empty report
 */
export function createNewReportData(): RiskInsightsData {
  return {
    creationDate: new Date(),
    reportData: [],
    summaryData: createNewSummaryData(),
    applicationData: [],
  };
}

/**
 * Create a new Risk Insights Report Summary
 *
 * @returns An empty report summary
 */
export function createNewSummaryData(): OrganizationReportSummary {
  return {
    totalMemberCount: 0,
    totalAtRiskMemberCount: 0,
    totalApplicationCount: 0,
    totalAtRiskApplicationCount: 0,
    totalCriticalMemberCount: 0,
    totalCriticalAtRiskMemberCount: 0,
    totalCriticalApplicationCount: 0,
    totalCriticalAtRiskApplicationCount: 0,
    newApplications: [],
  };
}
