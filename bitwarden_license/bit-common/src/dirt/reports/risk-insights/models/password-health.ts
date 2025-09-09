// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Opaque } from "type-fest";

import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";
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

export type AppAtRiskMembersDialogParams = {
  members: MemberDetailsFlat[];
  applicationName: string;
};

/*
 * After data is encrypted, it is returned with the
 * encryption key used to encrypt the data.
 */
export interface EncryptedDataWithKey {
  organizationId: OrganizationId;
  encryptedData: EncryptedString;
  encryptionKey: EncryptedString;
}

/**
 * Request to drop a password health report application
 * Model is expected by the API endpoint
 */
export interface PasswordHealthReportApplicationDropRequest {
  organizationId: OrganizationId;
  passwordHealthReportApplicationIds: string[];
}

/**
 * Response from the API after marking an app as critical
 */
export interface PasswordHealthReportApplicationsResponse {
  id: PasswordHealthReportApplicationId;
  organizationId: OrganizationId;
  uri: string;
}
/*
 * Request to save a password health report application
 * Model is expected by the API endpoint
 */
export interface PasswordHealthReportApplicationsRequest {
  organizationId: OrganizationId;
  url: string;
}

export interface EncryptedDataModel {
  organizationId: OrganizationId;
  encryptedData: string;
  encryptionKey: string;
  date: Date;
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum DrawerType {
  None = 0,
  AppAtRiskMembers = 1,
  OrgAtRiskMembers = 2,
  OrgAtRiskApps = 3,
}

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

export interface SaveRiskInsightsReportRequest {
  data: RiskInsightsReport;
}

export interface SaveRiskInsightsReportResponse {
  id: string;
}

export interface GetRiskInsightsReportResponse {
  id: string;
  organizationId: OrganizationId;
  date: string;
  reportData: EncryptedString;
  reportKey: EncryptedString;
}

export type PasswordHealthReportApplicationId = Opaque<string, "PasswordHealthReportApplicationId">;
