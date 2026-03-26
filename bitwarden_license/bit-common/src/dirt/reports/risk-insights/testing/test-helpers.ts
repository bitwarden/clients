/**
 * Shared test helpers for Risk Insights tests
 *
 * This module provides factory functions and utilities for creating test data
 * used across Risk Insights view tests, service tests, and integration tests.
 *
 * Usage:
 * - Import specific helpers: `import { createMember, createReport } from './testing/test-helpers';`
 * - Use in tests to create consistent, reusable test data
 *
 * Guidelines:
 * - Keep helpers simple and focused on data creation
 * - Use descriptive names following the `create*` pattern
 * - Leverage existing utilities from @bitwarden/common/spec when appropriate
 */

import { GetUniqueString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import {
  AccessReportMetrics,
  CipherHealthView,
  MemberRegistryEntryView,
  AccessReportSettingsView,
  ApplicationHealthView,
  AccessReportSummaryView,
  AccessReportView,
  MemberRegistry,
} from "../../../access-intelligence/models";
import {
  CollectionAccessDetails,
  GroupMembershipDetails,
  OrganizationUserView,
} from "../../../access-intelligence/services/abstractions/member-cipher-mapping.service";

// ==================== Member Helpers ====================

/**
 * Creates a test member (organization user)
 *
 * @param id - Member ID (defaults to unique string)
 * @param name - Display name (defaults to unique string)
 * @param email - Email address (defaults to unique string)
 * @returns OrganizationUserView for testing
 *
 * @example
 * const alice = createMember("u1", "Alice", "alice@example.com");
 * const randomMember = createMember(); // Auto-generated unique values
 */
export function createMember(id?: string, name?: string, email?: string): OrganizationUserView {
  const uniqueId = id ?? GetUniqueString("member");
  return {
    id: uniqueId,
    name: name ?? `User-${uniqueId}`,
    email: email ?? `${uniqueId}@example.com`,
  };
}

/**
 * Creates a member registry from an array of member definitions
 *
 * @param members - Array of member objects with id, name, email
 * @returns MemberRegistry (Record<string, MemberRegistryEntry>)
 *
 * @example
 * const registry = createMemberRegistry([
 *   { id: "u1", name: "Alice", email: "alice@example.com" },
 *   { id: "u2", name: "Bob", email: "bob@example.com" },
 * ]);
 */
export function createMemberRegistry(
  members: Array<{ id: string; name: string; email: string }>,
): MemberRegistry {
  const registry: MemberRegistry = {};
  members.forEach((m) => {
    registry[m.id] = MemberRegistryEntryView.fromData({
      id: m.id,
      userName: m.name,
      email: m.email,
    });
  });
  return registry;
}

// ==================== Cipher Helpers ====================

/**
 * Creates a test cipher with login URIs and collection assignments
 *
 * @param id - Cipher ID (defaults to unique string)
 * @param uris - Array of URI strings
 * @param collectionIds - Array of collection IDs cipher belongs to
 * @returns CipherView for testing
 *
 * @example
 * const githubCipher = createCipher("c1", ["https://github.com/login"], ["coll-1"]);
 */
export function createCipher(
  id?: string,
  uris: string[] = [],
  collectionIds: string[] = [],
): CipherView {
  const cipher = new CipherView();
  cipher.id = id ?? GetUniqueString("cipher");
  cipher.type = CipherType.Login;
  cipher.collectionIds = collectionIds;

  const login = new LoginView();
  login.uris = uris.map((uri) => {
    const uriView = new LoginUriView();
    uriView.uri = uri;
    return uriView;
  });
  cipher.login = login;

  return cipher;
}

/**
 * Creates a cipher health result
 *
 * @param isAtRisk - Whether the cipher is at-risk
 * @param options - Optional health details (weak, reused, exposed)
 * @returns CipherHealthView for testing
 *
 * @example
 * const atRiskHealth = createCipherHealth(true);
 * const weakPassword = createCipherHealth(true, { hasWeakPassword: true });
 */
export function createCipherHealth(
  isAtRisk: boolean,
  options?: {
    hasWeakPassword?: boolean;
    hasReusedPassword?: boolean;
    hasExposedPassword?: boolean;
    exposedCount?: number;
    weakPasswordScore?: number;
  },
): CipherHealthView {
  return new CipherHealthView({
    cipherId: GetUniqueString("cipher"),
    hasWeakPassword: options?.hasWeakPassword ?? isAtRisk,
    hasReusedPassword: options?.hasReusedPassword ?? false,
    hasExposedPassword: options?.hasExposedPassword ?? false,
    exposedCount: options?.exposedCount ?? 0,
    weakPasswordScore: options?.weakPasswordScore ?? (isAtRisk ? 1 : 4),
  });
}

// ==================== Collection & Group Helpers ====================

/**
 * Creates collection access details
 *
 * @param collectionId - Collection ID
 * @param userIds - Array of user IDs with access
 * @param groupIds - Array of group IDs with access
 * @returns CollectionAccessDetails for testing
 *
 * @example
 * const access = createCollectionAccess("coll-1", ["u1", "u2"], ["g1"]);
 */
export function createCollectionAccess(
  collectionId: string,
  userIds: string[] = [],
  groupIds: string[] = [],
): CollectionAccessDetails {
  return {
    collectionId,
    users: new Set(userIds),
    groups: new Set(groupIds),
  };
}

/**
 * Creates group membership details
 *
 * @param groupId - Group ID
 * @param memberIds - Array of member IDs in the group
 * @returns GroupMembershipDetails for testing
 *
 * @example
 * const devGroup = createGroupMembership("g1", ["u1", "u2", "u3"]);
 */
export function createGroupMembership(
  groupId: string,
  memberIds: string[] = [],
): GroupMembershipDetails {
  return {
    groupId,
    users: new Set(memberIds),
  };
}

// ==================== RiskInsights View Helpers ====================

/**
 * Creates a AccessReportView with sensible defaults
 *
 * @param options - Optional overrides for view properties
 * @returns AccessReportView for testing
 *
 * @example
 * // Minimal usage
 * const riskInsights = createRiskInsights();
 *
 * // With custom properties
 * const riskInsights = createRiskInsights({
 *   id: "report-123" as OrganizationReportId,
 *   organizationId: "org-456" as OrganizationId,
 *   reports: [createReport("github.com", {}, {})],
 * });
 */
export function createRiskInsights(
  options?: Partial<{
    id: OrganizationReportId;
    organizationId: OrganizationId;
    reports: ApplicationHealthView[];
    applications: AccessReportSettingsView[];
    memberRegistry: MemberRegistry;
    summary: AccessReportSummaryView;
    creationDate: Date;
  }>,
): AccessReportView {
  const view = new AccessReportView();
  if (options?.id) {
    view.id = options.id;
  }
  if (options?.organizationId) {
    view.organizationId = options.organizationId;
  }
  view.reports = options?.reports ?? [];
  view.applications = options?.applications ?? [];
  view.memberRegistry = options?.memberRegistry ?? {};
  view.summary = options?.summary ?? new AccessReportSummaryView();
  view.creationDate = options?.creationDate ?? new Date();
  return view;
}

/**
 * Creates a AccessReportSummaryView with specific counts
 *
 * @param counts - Optional count overrides (defaults to 0)
 * @returns AccessReportSummaryView for testing
 *
 * @example
 * const summary = createRiskInsightsSummary({
 *   totalApplicationCount: 10,
 *   totalAtRiskApplicationCount: 3,
 *   totalMemberCount: 50,
 *   totalAtRiskMemberCount: 10,
 * });
 */
export function createRiskInsightsSummary(
  counts?: Partial<{
    totalApplicationCount: number;
    totalAtRiskApplicationCount: number;
    totalCriticalApplicationCount: number;
    totalCriticalAtRiskApplicationCount: number;
    totalMemberCount: number;
    totalAtRiskMemberCount: number;
    totalCriticalMemberCount: number;
    totalCriticalAtRiskMemberCount: number;
    totalPasswordCount: number;
    totalAtRiskPasswordCount: number;
    totalCriticalPasswordCount: number;
    totalCriticalAtRiskPasswordCount: number;
  }>,
): AccessReportSummaryView {
  const summary = new AccessReportSummaryView();
  summary.totalApplicationCount = counts?.totalApplicationCount ?? 0;
  summary.totalAtRiskApplicationCount = counts?.totalAtRiskApplicationCount ?? 0;
  summary.totalCriticalApplicationCount = counts?.totalCriticalApplicationCount ?? 0;
  summary.totalCriticalAtRiskApplicationCount = counts?.totalCriticalAtRiskApplicationCount ?? 0;
  summary.totalMemberCount = counts?.totalMemberCount ?? 0;
  summary.totalAtRiskMemberCount = counts?.totalAtRiskMemberCount ?? 0;
  summary.totalCriticalMemberCount = counts?.totalCriticalMemberCount ?? 0;
  summary.totalCriticalAtRiskMemberCount = counts?.totalCriticalAtRiskMemberCount ?? 0;
  summary.totalPasswordCount = counts?.totalPasswordCount ?? 0;
  summary.totalAtRiskPasswordCount = counts?.totalAtRiskPasswordCount ?? 0;
  summary.totalCriticalPasswordCount = counts?.totalCriticalPasswordCount ?? 0;
  summary.totalCriticalAtRiskPasswordCount = counts?.totalCriticalAtRiskPasswordCount ?? 0;
  return summary;
}

/**
 * Creates AccessReportMetrics with specific counts
 *
 * @param counts - Optional count overrides (defaults to 0)
 * @returns AccessReportMetrics for testing
 *
 * @example
 * const metrics = createAccessReportMetrics({
 *   totalPasswordCount: 100,
 *   totalAtRiskPasswordCount: 20,
 * });
 */
export function createAccessReportMetrics(
  counts?: Partial<{
    totalApplicationCount: number;
    totalAtRiskApplicationCount: number;
    totalCriticalApplicationCount: number;
    totalCriticalAtRiskApplicationCount: number;
    totalMemberCount: number;
    totalAtRiskMemberCount: number;
    totalCriticalMemberCount: number;
    totalCriticalAtRiskMemberCount: number;
    totalPasswordCount: number;
    totalAtRiskPasswordCount: number;
    totalCriticalPasswordCount: number;
    totalCriticalAtRiskPasswordCount: number;
  }>,
): AccessReportMetrics {
  const metrics = new AccessReportMetrics();
  metrics.totalApplicationCount = counts?.totalApplicationCount ?? 0;
  metrics.totalAtRiskApplicationCount = counts?.totalAtRiskApplicationCount ?? 0;
  metrics.totalCriticalApplicationCount = counts?.totalCriticalApplicationCount ?? 0;
  metrics.totalCriticalAtRiskApplicationCount = counts?.totalCriticalAtRiskApplicationCount ?? 0;
  metrics.totalMemberCount = counts?.totalMemberCount ?? 0;
  metrics.totalAtRiskMemberCount = counts?.totalAtRiskMemberCount ?? 0;
  metrics.totalCriticalMemberCount = counts?.totalCriticalMemberCount ?? 0;
  metrics.totalCriticalAtRiskMemberCount = counts?.totalCriticalAtRiskMemberCount ?? 0;
  metrics.totalPasswordCount = counts?.totalPasswordCount ?? 0;
  metrics.totalAtRiskPasswordCount = counts?.totalAtRiskPasswordCount ?? 0;
  metrics.totalCriticalPasswordCount = counts?.totalCriticalPasswordCount ?? 0;
  metrics.totalCriticalAtRiskPasswordCount = counts?.totalCriticalAtRiskPasswordCount ?? 0;
  return metrics;
}

// ==================== Report & Application Helpers ====================

/**
 * Creates a risk insights report for an application
 *
 * @param applicationName - Name of the application (e.g., "github.com")
 * @param memberRefs - Record mapping member IDs to at-risk status
 * @param cipherRefs - Record mapping cipher IDs to at-risk status
 * @returns ApplicationHealthView for testing
 *
 * @example
 * const report = createReport(
 *   "github.com",
 *   { u1: true, u2: false },
 *   { c1: true, c2: false }
 * );
 */
export function createReport(
  applicationName: string,
  memberRefs: Record<string, boolean> = {},
  cipherRefs: Record<string, boolean> = {},
): ApplicationHealthView {
  const report = new ApplicationHealthView();
  report.applicationName = applicationName;
  report.memberRefs = memberRefs;
  report.cipherRefs = cipherRefs;
  report.passwordCount = Object.keys(cipherRefs).length;
  report.atRiskPasswordCount = Object.values(cipherRefs).filter((v) => v).length;
  report.memberCount = Object.keys(memberRefs).length;
  report.atRiskMemberCount = Object.values(memberRefs).filter((v) => v).length;
  return report;
}

/**
 * Creates an application metadata entry
 *
 * @param name - Application name
 * @param isCritical - Whether application is marked critical
 * @param reviewedDate - Optional review date
 * @returns AccessReportSettingsView for testing
 *
 * @example
 * const criticalApp = createApplication("github.com", true);
 * const reviewedApp = createApplication("gitlab.com", false, new Date("2024-01-15"));
 */
export function createApplication(
  name: string,
  isCritical = false,
  reviewedDate?: Date,
): AccessReportSettingsView {
  const app = new AccessReportSettingsView();
  app.applicationName = name;
  app.isCritical = isCritical;
  app.reviewedDate = reviewedDate;
  return app;
}

// ==================== Composite Helpers ====================

/**
 * Creates a complete test scenario with members, ciphers, and access
 *
 * @param options - Configuration for the scenario
 * @returns Object containing all created test data
 *
 * @example
 * const scenario = createTestScenario({
 *   memberCount: 3,
 *   applications: ["github.com", "gitlab.com"],
 * });
 */
export function createTestScenario(options: {
  memberCount?: number;
  applications?: string[];
  ciphersPerApp?: number;
}) {
  const memberCount = options.memberCount ?? 2;
  const applications = options.applications ?? ["github.com"];
  const ciphersPerApp = options.ciphersPerApp ?? 2;

  // Create members
  const members: OrganizationUserView[] = [];
  for (let i = 0; i < memberCount; i++) {
    members.push(createMember(`u${i + 1}`, `User${i + 1}`, `user${i + 1}@example.com`));
  }

  // Create ciphers for each application
  const ciphers: CipherView[] = [];
  const collections: CollectionAccessDetails[] = [];

  applications.forEach((app, appIndex) => {
    const collectionId = `coll-${appIndex + 1}`;

    // Create ciphers for this app
    for (let i = 0; i < ciphersPerApp; i++) {
      ciphers.push(
        createCipher(`c${appIndex * ciphersPerApp + i + 1}`, [`https://${app}`], [collectionId]),
      );
    }

    // Give all members access to this collection
    collections.push(
      createCollectionAccess(
        collectionId,
        members.map((m) => m.id),
        [],
      ),
    );
  });

  return {
    members,
    ciphers,
    collections,
    groups: [] as GroupMembershipDetails[],
  };
}
