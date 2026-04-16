import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportApi } from "../api/access-report.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportData } from "../data/access-report.data";
import { AccessReport } from "../domain/access-report";
import { AccessReportMetrics } from "../domain/access-report-metrics";

import { AccessReportSettingsView } from "./access-report-settings.view";
import { AccessReportSummaryView } from "./access-report-summary.view";
import { ApplicationHealthView } from "./application-health.view";
import { MemberRegistryEntryView } from "./member-registry-entry.view";

/** Deduplicated member lookup table keyed by organization user ID */
export type MemberRegistry = Record<string, MemberRegistryEntryView>;

/**
 * View model for Access Report containing decrypted properties
 *
 * Uses the member registry pattern to eliminate duplicate member storage across applications.
 * The registry is shared across all application reports and provides O(1) member lookup.
 *
 * - See {@link AccessReport} for domain model
 * - See {@link AccessReportData} for data model
 * - See {@link AccessReportApi} for API model
 */
export class AccessReportView implements View {
  id: OrganizationReportId = "" as OrganizationReportId;
  organizationId: OrganizationId = "" as OrganizationId;
  reports: ApplicationHealthView[] = [];
  applications: AccessReportSettingsView[] = [];
  summary = new AccessReportSummaryView();
  memberRegistry: MemberRegistry = {};
  creationDate: Date;
  contentEncryptionKey?: EncString;

  constructor(report?: AccessReport) {
    if (!report) {
      this.creationDate = new Date();
      return;
    }

    this.id = report.id as OrganizationReportId;
    this.organizationId = report.organizationId as OrganizationId;
    this.creationDate = report.creationDate;
    this.contentEncryptionKey = report.contentEncryptionKey;
  }

  // === Query Methods ===

  /**
   * Get all at-risk members across all applications
   *
   * Deduplicates members - a member appearing in multiple applications is counted once.
   *
   * @returns Array of unique at-risk member registry entries
   */
  getAtRiskMembers(): MemberRegistryEntryView[] {
    const atRiskMemberIds = new Set<string>();

    this.reports.forEach((report) => {
      Object.entries(report.memberRefs)
        .filter(([_, isAtRisk]) => isAtRisk)
        .forEach(([memberId]) => atRiskMemberIds.add(memberId));
    });

    return Array.from(atRiskMemberIds)
      .map((id) => this.memberRegistry[id])
      .filter((entry): entry is MemberRegistryEntryView => entry !== undefined);
  }

  /**
   * Get all application reports with at least one at-risk cipher
   *
   * @returns Array of application reports where at least one cipher is at-risk
   */
  getAtRiskApplications(): ApplicationHealthView[] {
    return this.reports.filter((r) => r.isAtRisk());
  }

  /**
   * Get only applications marked as critical
   *
   * @returns Array of critical application reports
   */
  getCriticalApplications(): ApplicationHealthView[] {
    const criticalNames = new Set(
      this.applications.filter((a) => a.isCritical).map((a) => a.applicationName),
    );
    return this.reports.filter((r) => criticalNames.has(r.applicationName));
  }

  /**
   * Get critical applications that have at least one at-risk cipher
   *
   * @returns Array of critical application reports where at least one cipher is at-risk
   */
  getCriticalAtRiskApplications(): ApplicationHealthView[] {
    return this.getCriticalApplications().filter((r) => r.isAtRisk());
  }

  /**
   * Get at-risk members across all critical applications
   *
   * Deduplicates members - a member appearing in multiple critical applications is counted once.
   *
   * @returns Array of unique at-risk member registry entries from critical applications
   */
  getCriticalAtRiskMembers(): MemberRegistryEntryView[] {
    const criticalAtRiskMemberIds = new Set<string>();

    this.getCriticalApplications().forEach((report) => {
      Object.entries(report.memberRefs)
        .filter(([_, isAtRisk]) => isAtRisk)
        .forEach(([memberId]) => criticalAtRiskMemberIds.add(memberId));
    });

    return Array.from(criticalAtRiskMemberIds)
      .map((id) => this.memberRegistry[id])
      .filter((entry): entry is MemberRegistryEntryView => entry !== undefined);
  }

  /**
   * Get applications that haven't been reviewed yet
   *
   * An application is considered "new" if it has no reviewedDate.
   *
   * @returns Array of unreviewed application reports
   */
  getNewApplications(): ApplicationHealthView[] {
    const unreviewedNames = new Set(
      this.applications.filter((a) => !a.reviewedDate).map((a) => a.applicationName),
    );
    return this.reports.filter((r) => unreviewedNames.has(r.applicationName));
  }

  /**
   * Find an application report by name
   *
   * @param applicationName - Name of the application to find
   * @returns Application report if found, undefined otherwise
   */
  getApplicationByName(applicationName: string): ApplicationHealthView | undefined {
    return this.reports.find((r) => r.applicationName === applicationName);
  }

  /**
   * Get total count of unique members in the organization
   *
   * @returns Number of members in the registry
   */
  getTotalMemberCount(): number {
    return Object.keys(this.memberRegistry).length;
  }

  /**
   * Get at-risk password count for a specific member
   *
   * Counts all at-risk passwords across applications where member has access.
   * Optionally limits count to a specific application.
   *
   * @param memberId - Organization user ID
   * @param applicationName - Optional: limit count to specific application
   * @returns Count of at-risk passwords for this member
   */
  getAtRiskPasswordCountForMember(memberId: string, applicationName?: string): number {
    if (applicationName) {
      // Count only within specific application
      const app = this.getApplicationByName(applicationName);
      if (!app || !app.isMemberAtRisk(memberId)) {
        return 0;
      }
      return app.getAtRiskCipherIds().length;
    }

    // Count across all applications where member is at-risk
    let count = 0;
    this.reports.forEach((report) => {
      if (report.memberRefs[memberId] === true) {
        count += report.getAtRiskCipherIds().length;
      }
    });
    return count;
  }

  // === Update Methods ===

  /**
   * Mark multiple applications as critical in a single operation
   *
   * Mutates all application entries first, then recomputes the summary once.
   * Prefer this over calling markApplicationAsCritical() in a loop.
   *
   * @param applicationNames - Names of the applications to mark as critical
   */
  markApplicationsAsCritical(applicationNames: string[]): void {
    for (const applicationName of applicationNames) {
      const app = this.applications.find((a) => a.applicationName === applicationName);

      if (app) {
        app.isCritical = true;
        if (!app.reviewedDate) {
          app.reviewedDate = new Date();
        }
      } else {
        // Application not in list, add it
        const newApp = new AccessReportSettingsView();
        newApp.applicationName = applicationName;
        newApp.isCritical = true;
        newApp.reviewedDate = new Date();
        this.applications.push(newApp);
      }
    }

    this.recomputeSummary();
  }

  /**
   * Unmark multiple applications as critical in a single operation
   *
   * Mutates all application entries first, then recomputes the summary once.
   *
   * @param applicationNames - Names of the applications to unmark as critical
   */
  unmarkApplicationsAsCritical(applicationNames: string[]): void {
    for (const applicationName of applicationNames) {
      const app = this.applications.find((a) => a.applicationName === applicationName);
      if (app) {
        app.isCritical = false;
      }
    }
    this.recomputeSummary();
  }

  /**
   * Mark an application as reviewed
   *
   * Updates the applications array with the review date.
   * Review status does not affect summary, so no recomputation is needed.
   *
   * @param applicationName - Name of the application to mark as reviewed
   * @param reviewedDate - Date of review (defaults to current date)
   */
  markApplicationAsReviewed(applicationName: string, reviewedDate?: Date): void {
    const app = this.applications.find((a) => a.applicationName === applicationName);

    if (app) {
      app.reviewedDate = reviewedDate ?? new Date();
    } else {
      const newApp = new AccessReportSettingsView();
      newApp.applicationName = applicationName;
      newApp.reviewedDate = reviewedDate ?? new Date();
      this.applications.push(newApp);
    }
  }

  // === Computation Methods ===

  /**
   * Recomputes the summary from current reports and applications
   *
   * Called automatically when critical application flags change. Can also be called
   * manually to force a summary refresh.
   *
   * Computes:
   * - Total and at-risk application counts
   * - Total and at-risk member counts (deduplicated)
   * - Critical application and member counts
   */
  recomputeSummary(): void {
    const summary = new AccessReportSummaryView();

    // Basic totals
    summary.totalMemberCount = this.getTotalMemberCount();
    summary.totalApplicationCount = this.reports.length;
    summary.totalAtRiskApplicationCount = this.reports.filter((r) => r.isAtRisk()).length;

    // Deduplicate at-risk members across all applications
    summary.totalAtRiskMemberCount = this.getAtRiskMembers().length;

    // Critical application metrics
    const criticalReports = this.getCriticalApplications();
    summary.totalCriticalApplicationCount = criticalReports.length;
    summary.totalCriticalAtRiskApplicationCount = criticalReports.filter((r) =>
      r.isAtRisk(),
    ).length;

    // Collect unique critical member IDs
    const criticalMemberIds = new Set<string>();
    const criticalAtRiskMemberIds = new Set<string>();

    criticalReports.forEach((report) => {
      Object.entries(report.memberRefs).forEach(([memberId, isAtRisk]) => {
        criticalMemberIds.add(memberId);
        if (isAtRisk) {
          criticalAtRiskMemberIds.add(memberId);
        }
      });
    });

    summary.totalCriticalMemberCount = criticalMemberIds.size;
    summary.totalCriticalAtRiskMemberCount = criticalAtRiskMemberIds.size;

    // Password counts — aggregate from cipher refs across all reports
    const criticalAppNames = new Set(
      this.applications.filter((a) => a.isCritical).map((a) => a.applicationName),
    );

    let totalPasswordCount = 0;
    let totalAtRiskPasswordCount = 0;
    let totalCriticalPasswordCount = 0;
    let totalCriticalAtRiskPasswordCount = 0;

    this.reports.forEach((report) => {
      const isCritical = criticalAppNames.has(report.applicationName);
      const passwordCount = Object.keys(report.cipherRefs).length;
      const atRiskCount = report.getAtRiskCipherIds().length;

      totalPasswordCount += passwordCount;
      totalAtRiskPasswordCount += atRiskCount;

      if (isCritical) {
        totalCriticalPasswordCount += passwordCount;
        totalCriticalAtRiskPasswordCount += atRiskCount;
      }
    });

    summary.totalPasswordCount = totalPasswordCount;
    summary.totalAtRiskPasswordCount = totalAtRiskPasswordCount;
    summary.totalCriticalPasswordCount = totalCriticalPasswordCount;
    summary.totalCriticalAtRiskPasswordCount = totalCriticalAtRiskPasswordCount;

    this.summary = summary;
  }

  /**
   * Computes complete metrics from current view state
   *
   * Generates AccessReportMetrics including both summary counts and password-level metrics.
   * Password counts are computed by aggregating cipherRefs across all reports.
   *
   * @returns AccessReportMetrics with all counts populated
   */
  toMetrics(): AccessReportMetrics {
    const metrics = new AccessReportMetrics();

    // Copy summary counts (member and application counts)
    metrics.totalApplicationCount = this.summary.totalApplicationCount;
    metrics.totalAtRiskApplicationCount = this.summary.totalAtRiskApplicationCount;
    metrics.totalCriticalApplicationCount = this.summary.totalCriticalApplicationCount;
    metrics.totalCriticalAtRiskApplicationCount = this.summary.totalCriticalAtRiskApplicationCount;
    metrics.totalMemberCount = this.summary.totalMemberCount;
    metrics.totalAtRiskMemberCount = this.summary.totalAtRiskMemberCount;
    metrics.totalCriticalMemberCount = this.summary.totalCriticalMemberCount;
    metrics.totalCriticalAtRiskMemberCount = this.summary.totalCriticalAtRiskMemberCount;

    // Compute password counts from reports
    let totalPasswordCount = 0;
    let totalAtRiskPasswordCount = 0;
    let totalCriticalPasswordCount = 0;
    let totalCriticalAtRiskPasswordCount = 0;

    // Build set of critical application names for quick lookup
    const criticalAppNames = new Set(
      this.applications.filter((a) => a.isCritical).map((a) => a.applicationName),
    );

    this.reports.forEach((report) => {
      const isCritical = criticalAppNames.has(report.applicationName);
      const passwordCount = Object.keys(report.cipherRefs).length;
      const atRiskCount = report.getAtRiskCipherIds().length;

      totalPasswordCount += passwordCount;
      totalAtRiskPasswordCount += atRiskCount;

      if (isCritical) {
        totalCriticalPasswordCount += passwordCount;
        totalCriticalAtRiskPasswordCount += atRiskCount;
      }
    });

    metrics.totalPasswordCount = totalPasswordCount;
    metrics.totalAtRiskPasswordCount = totalAtRiskPasswordCount;
    metrics.totalCriticalPasswordCount = totalCriticalPasswordCount;
    metrics.totalCriticalAtRiskPasswordCount = totalCriticalAtRiskPasswordCount;

    return metrics;
  }

  // === Serialization ===

  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<DeepJsonify<AccessReportView>> | null): AccessReportView {
    if (obj == undefined) {
      return new AccessReportView();
    }

    const view = Object.assign(new AccessReportView(), obj) as AccessReportView;

    view.reports = obj.reports?.map((report) => ApplicationHealthView.fromJSON(report)) ?? [];
    view.applications = obj.applications?.map((a) => AccessReportSettingsView.fromJSON(a)) ?? [];
    view.summary = AccessReportSummaryView.fromJSON(obj.summary ?? {});
    view.memberRegistry = obj.memberRegistry
      ? Object.fromEntries(
          Object.entries(obj.memberRegistry).map(([k, v]) => [
            k,
            MemberRegistryEntryView.fromJSON(v ?? undefined),
          ]),
        )
      : {};

    return view;
  }
}
