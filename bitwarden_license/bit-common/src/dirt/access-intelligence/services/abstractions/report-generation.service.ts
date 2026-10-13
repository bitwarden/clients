import { Observable } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessReportSettingsView, AccessReportView } from "../../models";

import {
  CollectionAccessDetails,
  GroupMembershipDetails,
  OrganizationUserView,
} from "./member-cipher-mapping.service";

/**
 * Generates Risk Insights reports from pre-loaded organization data.
 *
 * Orchestrates health checks, member mapping, aggregation, and summary computation
 * to produce a complete AccessReportView. Does NOT handle data loading or persistence.
 *
 * Platform-agnostic domain service used by AccessIntelligenceDataService.
 */
export abstract class ReportGenerationService {
  /**
   * Generates a new Risk Insights report from organization data.
   *
   * Runs health checks on ciphers, maps ciphers to members via collections and groups,
   * aggregates into per-application reports, carries over application metadata from
   * the previous report, and computes summary statistics.
   *
   * @param ciphers - Organization ciphers to analyze
   * @param members - Organization members/users
   * @param collectionAccess - Collection access details (which users/groups can access each collection)
   * @param groupMemberships - Group membership details (which users are in each group)
   * @param previousApplications - Previous application metadata to preserve critical flags and review dates
   * @returns Observable of complete AccessReportView ready for persistence
   *
   * @example
   * ```typescript
   * // In AccessIntelligenceDataService
   * const ciphers = await this.cipherService.getAllFromApiForOrganization(orgId);
   * const members = await this.organizationService.getOrganizationUsers(orgId);
   * // ... load collections and groups, transform to access details
   *
   * this.reportGenerationService
   *   .generateReport$(ciphers, members, collectionAccess, groupMemberships, previousApps)
   *   .pipe(switchMap(report => this.persistenceService.save(report)))
   *   .subscribe();
   * ```
   */
  abstract generateReport$(
    ciphers: CipherView[],
    members: OrganizationUserView[],
    collectionAccess: CollectionAccessDetails[],
    groupMemberships: GroupMembershipDetails[],
    previousApplications?: AccessReportSettingsView[],
  ): Observable<AccessReportView>;
}
