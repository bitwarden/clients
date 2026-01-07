import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AtRiskApplicationDetail,
  AtRiskMemberDetail,
  MemberCipherDetailsResponse,
} from "../models";
import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportSummary,
} from "../models/report-models";

export function flattenMemberDetails(
  memberCiphers: MemberCipherDetailsResponse[],
): MemberDetails[] {
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

  uris.forEach((u: { uri: string | undefined }) => {
    const domain = Utils.getDomain(u.uri) ?? u.uri;
    uniqueDomains.add(domain);
  });
  return Array.from(uniqueDomains);
}

// Returns a deduplicated array of members by email
export function getUniqueMembers(orgMembers: MemberDetails[]): MemberDetails[] {
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
  };
}
export function getAtRiskApplicationList(
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
 * Generates a list of members with at-risk passwords along with the number of at-risk passwords.
 */
export function getAtRiskMemberList(
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

/**
 * Builds a map of passwords to the number of times they are used across ciphers
 *
 * @param ciphers List of ciphers to check for password reuse
 * @returns A map where the key is the password and the value is the number of times it is used
 */
export function buildPasswordUseMap(ciphers: CipherView[]): Map<string, number> {
  const passwordUseMap = new Map<string, number>();
  ciphers.forEach((cipher) => {
    const password = cipher.login.password!;
    passwordUseMap.set(password, (passwordUseMap.get(password) || 0) + 1);
  });
  return passwordUseMap;
}
