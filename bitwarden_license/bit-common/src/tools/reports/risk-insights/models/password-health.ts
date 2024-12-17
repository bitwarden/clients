// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant } from "@bitwarden/components";

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
  memberCount: number;

  memberDetails: MemberDetailsFlat[];
  atRiskMemberDetails: MemberDetailsFlat[];
};

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
  exposedXTimes: number;
} | null;

/**
 * Flattened member details that associates an
 * organization member to a cipher
 */
export type MemberDetailsFlat = {
  userName: string;
  email: string;
  cipherId: string;
};
