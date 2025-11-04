import { Opaque } from "type-fest";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationReportId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant } from "@bitwarden/components";

import { ExposedPasswordDetail, WeakPasswordDetail } from "./password-health";

// -------------------- Member Models --------------------

/**
 * Flattened member details that associates an
 * organization member to a cipher
 */
export type MemberDetails = {
  userGuid: string;
  userName: string | null;
  email: string;
  cipherId: string;
};

// -------------------- Cipher Models --------------------

export type PasswordHealthData = {
  reusedPasswordCount: number;
  weakPasswordDetail: WeakPasswordDetail;
  exposedPasswordDetail: ExposedPasswordDetail;
};

/**
 * Associates a cipher with it's essential information.
 * Gets the password health details, cipher members, and
 * the trimmed uris for the cipher
 */
export type CipherHealthReport = {
  applications: string[];
  cipherMembers: MemberDetails[];
  healthData: PasswordHealthData;
  cipher: CipherView;
};

// -------------------- Application Health Report Models --------------------
/**
 * All applications report summary. The total members,
 * total at risk members, application, and at risk application
 * counts. Aggregated from all calculated applications
 */
export type OrganizationReportSummary = {
  totalMemberCount: number;
  totalApplicationCount: number;
  totalAtRiskMemberCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalCriticalMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalCriticalAtRiskApplicationCount: number;
};

/**
 * An entry for an organization application and if it is
 * marked as critical
 */
export type OrganizationReportApplication = {
  applicationName: string;
  isCritical: boolean;
  /**
   * Captures when a report has been reviewed by a user and
   * can be filtered on to check for new applications
   * */
  reviewedDate: Date | null;
};

/**
 * Report details for an application
 * uri. Has the at risk, password, and member information
 */
export type ApplicationHealthReportDetail = {
  applicationName: string;
  passwordCount: number;
  atRiskPasswordCount: number;
  atRiskCipherIds: string[];
  memberCount: number;
  atRiskMemberCount: number;
  memberDetails: MemberDetails[];
  atRiskMemberDetails: MemberDetails[];
  cipherIds: string[];
};

// -------------------- Password Health Report Models --------------------
export type PasswordHealthReportApplicationId = Opaque<string, "PasswordHealthReportApplicationId">;

export type ReportScore = { label: string; badgeVariant: BadgeVariant; sortOrder: number };

export type ReportResult = CipherView & {
  score: number;
  reportValue: ReportScore;
  scoreKey: number;
};

export const ReportStatus = Object.freeze({
  Initializing: 1,
  Loading: 2,
  Complete: 3,
  Error: 4,
} as const);

export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export interface RiskInsightsData {
  id: OrganizationReportId;
  creationDate: Date;
  contentEncryptionKey: EncString;
  reportData: ApplicationHealthReportDetail[];
  summaryData: OrganizationReportSummary;
  applicationData: OrganizationReportApplication[];
}

export interface ReportState {
  status: ReportStatus;
  error: string | null;
  data: RiskInsightsData | null;
}

// TODO Make Versioned models for structure changes
// export type VersionedRiskInsightsData = RiskInsightsDataV1 | RiskInsightsDataV2;
// export interface RiskInsightsDataV1 {
//   version: 1;
//   creationDate: Date;
//   reportData: ApplicationHealthReportDetail[];
//   summaryData: OrganizationReportSummary;
//   applicationData: OrganizationReportApplication[];
// }
