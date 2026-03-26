import { DrawerType } from "@bitwarden/bit-common/dirt/access-intelligence/services";

/**
 * Base member data included in drawer content.
 * Represents a member with their at-risk password count.
 */
export interface DrawerMemberData {
  /** Member's email address */
  email: string;
  /** Member's display name */
  userName: string;
  /** Organization user ID (userGuid) */
  userGuid: string;
  /** Number of at-risk passwords for this member */
  atRiskPasswordCount: number;
}

/**
 * Base application data included in drawer content.
 * Represents an application with its at-risk password count.
 */
export interface DrawerApplicationData {
  /** Application name (hostname) */
  applicationName: string;
  /** Number of at-risk passwords for this application */
  atRiskPasswordCount: number;
}

/**
 * Organization-wide at-risk members drawer content.
 * Shows all members across the organization with at-risk passwords.
 */
export interface OrgAtRiskMembersData {
  type: typeof DrawerType.OrgAtRiskMembers;
  members: DrawerMemberData[];
}

/**
 * Application-specific at-risk members drawer content.
 * Shows members with at-risk passwords for a specific application.
 */
export interface AppAtRiskMembersData {
  type: typeof DrawerType.AppAtRiskMembers;
  applicationName: string;
  members: DrawerMemberData[];
}

/**
 * Organization-wide at-risk applications drawer content.
 * Shows all applications with at-risk passwords.
 */
export interface OrgAtRiskAppsData {
  type: typeof DrawerType.OrgAtRiskApps;
  applications: DrawerApplicationData[];
}

/**
 * Critical applications' at-risk members drawer content.
 * Shows members with at-risk passwords across all critical applications.
 */
export interface CriticalAtRiskMembersData {
  type: typeof DrawerType.CriticalAtRiskMembers;
  members: DrawerMemberData[];
}

/**
 * Critical applications' at-risk apps drawer content.
 * Shows critical applications that have at-risk passwords.
 */
export interface CriticalAtRiskAppsData {
  type: typeof DrawerType.CriticalAtRiskApps;
  applications: DrawerApplicationData[];
}

/**
 * Union type of all possible drawer content data.
 * Used as input to AccessIntelligenceDrawerV2Component.
 *
 * Components derive this content from report$ observable + drawerState signal
 * using view model query methods (e.g., report.getAtRiskMembers()).
 */
export type DrawerContentData =
  | OrgAtRiskMembersData
  | AppAtRiskMembersData
  | OrgAtRiskAppsData
  | CriticalAtRiskMembersData
  | CriticalAtRiskAppsData;
