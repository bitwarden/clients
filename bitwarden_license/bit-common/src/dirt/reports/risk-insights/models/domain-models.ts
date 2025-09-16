import { Opaque } from "type-fest";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant } from "@bitwarden/components";

// -------------------- Core Domain Types --------------------
export type PasswordHealthReportApplicationId = Opaque<string, "PasswordHealthReportApplicationId">;

// -------------------- Application Health Report Models --------------------
/**
 * All applications report summary. The total members,
 * total at risk members, application, and at risk application
 * counts. Aggregated from all calculated applications
 */
export type ApplicationHealthReportSummary = {
  totalMemberCount: number;
  totalAtRiskMemberCount: number;
  totalApplicationCount: number;
  totalAtRiskApplicationCount: number;
};

/**
 * All applications report detail. Application is the cipher
 * uri. Has the at risk, password, and member information
 */
export type ApplicationHealthReportDetail = {
  applicationName: string;
  passwordCount: number;
  atRiskPasswordCount: number;
  atRiskCipherIds: string[];
  memberCount: number;
  atRiskMemberCount: number;
  memberDetails: MemberDetailsFlat[];
  atRiskMemberDetails: MemberDetailsFlat[];
  cipherIds: string[];
};

export type ApplicationHealthReportDetailWithCriticalFlag = ApplicationHealthReportDetail & {
  isMarkedAsCritical: boolean;
};

export type ApplicationHealthReportDetailWithCriticalFlagAndCipher =
  ApplicationHealthReportDetailWithCriticalFlag & {
    ciphers: CipherView[];
  };

// -------------------- Cipher Health Report Models --------------------
/**
 * Breaks the cipher health info out by uri and passes
 * along the password health and member info
 */
export type CipherHealthReportUriDetail = {
  cipherId: string;
  reusedPasswordCount: number;
  weakPasswordDetail: WeakPasswordDetail;
  exposedPasswordDetail: ExposedPasswordDetail;
  cipherMembers: MemberDetailsFlat[];
  trimmedUri: string;
  cipher: CipherView;
};

/**
 * Associates a cipher with it's essential information.
 * Gets the password health details, cipher members, and
 * the trimmed uris for the cipher
 */
export type CipherHealthReportDetail = CipherView & {
  reusedPasswordCount: number;
  weakPasswordDetail: WeakPasswordDetail;
  exposedPasswordDetail: ExposedPasswordDetail;
  cipherMembers: MemberDetailsFlat[];
  trimmedUris: string[];
};

// -------------------- Password Health Models --------------------
/**
 * Weak password details containing the score
 * and the score type for the label and badge
 */
export type WeakPasswordDetail = {
  score: number;
  detailValue: WeakPasswordScore;
} | null;

/**
 * Weak password details containing the badge and
 * the label for the password score
 */
export type WeakPasswordScore = {
  label: string;
  badgeVariant: BadgeVariant;
} | null;

/**
 * How many times a password has been exposed
 */
export type ExposedPasswordDetail = {
  cipherId: string;
  exposedXTimes: number;
} | null;

// -------------------- Member Models --------------------
/**
 * Flattened member details that associates an
 * organization member to a cipher
 */
export type MemberDetailsFlat = {
  userGuid: string;
  userName: string;
  email: string;
  cipherId: string;
};

/**
 * Member email with the number of at risk passwords
 * At risk member detail that contains the email
 * and the count of at risk ciphers
 */
export type AtRiskMemberDetail = {
  email: string;
  atRiskPasswordCount: number;
};

/*
 * A list of applications and the count of
 * at risk passwords for each application
 */
export type AtRiskApplicationDetail = {
  applicationName: string;
  atRiskPasswordCount: number;
};

// -------------------- Risk Insights Report Models --------------------
export interface RiskInsightsReport {
  organizationId: OrganizationId;
  date: string;
  reportData: string;
  reportKey: string;
}

export interface ReportInsightsReportData {
  data: ApplicationHealthReportDetail[];
  summary: ApplicationHealthReportSummary;
}
