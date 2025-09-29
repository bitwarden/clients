import { Opaque } from "type-fest";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant } from "@bitwarden/components";

import { ExposedPasswordDetail, WeakPasswordDetail } from "./password-health";

// -------------------- Drawer and UI Models --------------------
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum DrawerType {
  None = 0,
  AppAtRiskMembers = 1,
  OrgAtRiskMembers = 2,
  OrgAtRiskApps = 3,
}

export type DrawerDetails = {
  open: boolean;
  invokerId: string;
  activeDrawerType: DrawerType;
  atRiskMemberDetails?: AtRiskMemberDetail[];
  appAtRiskMembers?: AppAtRiskMembersDialogParams | null;
  atRiskAppDetails?: AtRiskApplicationDetail[] | null;
};

export type AppAtRiskMembersDialogParams = {
  members: MemberDetails[];
  applicationName: string;
};

// -------------------- Member Models --------------------
/**
 * Member email with the number of at risk passwords
 * At risk member detail that contains the email
 * and the count of at risk ciphers
 */
export type AtRiskMemberDetail = {
  email: string;
  atRiskPasswordCount: number;
};

/**
 * Flattened member details that associates an
 * organization member to a cipher
 */
export type MemberDetails = {
  userGuid: string;
  userName: string;
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

/**
 * Breaks the cipher health info out by uri and passes
 * along the password health and member info
 */
export type CipherApplicationView = {
  cipherId: string;
  cipher: CipherView;
  cipherMembers: MemberDetails[];
  application: string;
  healthData: PasswordHealthData;
};

// -------------------- Application Health Report Models --------------------
/**
 * All applications report summary. The total members,
 * total at risk members, application, and at risk application
 * counts. Aggregated from all calculated applications
 */
export type OrganizationReportSummary = {
  totalMemberCount: number;
  totalCriticalMemberCount: number;
  totalAtRiskMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalAtRiskApplicationCount: number;
  newApplications: string[];
};

export type CriticalSummaryDetails = {
  totalCriticalMembersCount: number;
  totalCriticalApplicationsCount: number;
};

/**
 * An entry for an organization application and if it is
 * marked as critical
 */
export type OrganizationReportApplication = {
  applicationName: string;
  isCritical: boolean;
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

export type ApplicationHealthReportDetailEnriched = ApplicationHealthReportDetail & {
  isMarkedAsCritical: boolean;
  ciphers: CipherView[];
};

/*
 * A list of applications and the count of
 * at risk passwords for each application
 */
export type AtRiskApplicationDetail = {
  applicationName: string;
  atRiskPasswordCount: number;
};

// -------------------- Password Health Report Models --------------------
export type PasswordHealthReportApplicationId = Opaque<string, "PasswordHealthReportApplicationId">;

// -------------------- Risk Insights Report Models --------------------
export interface RiskInsightsReportData {
  reportData: ApplicationHealthReportDetailEnriched[];
  summaryData: OrganizationReportSummary;
}

export type ReportScore = { label: string; badgeVariant: BadgeVariant; sortOrder: number };

export type ReportResult = CipherView & {
  score: number;
  reportValue: ReportScore;
  scoreKey: number;
};

export type ReportDetailsAndSummary = {
  data: ApplicationHealthReportDetailEnriched[];
  summary: OrganizationReportSummary;
  dateCreated: Date;
};
