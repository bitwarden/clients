import { forkJoin, map, Observable } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { LogService } from "@bitwarden/logging";

import { getTrimmedCipherUris } from "../../../../reports/risk-insights/helpers";
import {
  AccessReportSettingsView,
  ApplicationHealthView,
  AccessReportView,
  MemberRegistry,
} from "../../../models";
import { CipherHealthService } from "../../abstractions/cipher-health.service";
import {
  CollectionAccessDetails,
  GroupMembershipDetails,
  MemberCipherMappingService,
  OrganizationUserView,
} from "../../abstractions/member-cipher-mapping.service";
import { ReportGenerationService } from "../../abstractions/report-generation.service";

/**
 * Default implementation of ReportGenerationService.
 *
 * Orchestrates health checks, member mapping, aggregation, and summary computation
 * from pre-loaded organization data.
 */
export class DefaultReportGenerationService extends ReportGenerationService {
  constructor(
    private cipherHealthService: CipherHealthService,
    private memberCipherMappingService: MemberCipherMappingService,
    private logService: LogService,
  ) {
    super();
  }

  generateReport$(
    ciphers: CipherView[],
    members: OrganizationUserView[],
    collectionAccess: CollectionAccessDetails[],
    groupMemberships: GroupMembershipDetails[],
    previousApplications?: AccessReportSettingsView[],
  ): Observable<AccessReportView> {
    this.logService.debug("[DefaultReportGenerationService] Starting report generation", {
      cipherCount: ciphers.length,
      memberCount: members.length,
      collectionCount: collectionAccess.length,
      groupCount: groupMemberships.length,
    });

    return this.runHealthAndMappingPipeline(
      ciphers,
      members,
      collectionAccess,
      groupMemberships,
    ).pipe(
      map(({ ciphers: processedCiphers, healthMap, memberMapping, registry }) => {
        const reports = this.aggregateIntoReports(processedCiphers, healthMap, memberMapping);

        // Build view and populate with generated data
        const view = new AccessReportView();
        view.id = "" as any; // Temporary ID, will be set by persistence service on save
        view.reports = reports;
        view.memberRegistry = registry;
        view.creationDate = new Date();

        // Carry over application metadata from previous report
        this.carryOverApplicationMetadata(view, previousApplications ?? []);

        // Compute summary (delegates to smart model method)
        view.recomputeSummary();

        return view;
      }),
    );
  }

  /**
   * Runs health checks and member mapping in parallel
   */
  private runHealthAndMappingPipeline(
    ciphers: CipherView[],
    members: OrganizationUserView[],
    collectionAccess: CollectionAccessDetails[],
    groupMemberships: GroupMembershipDetails[],
  ): Observable<{
    ciphers: CipherView[];
    healthMap: Map<string, any>;
    memberMapping: Map<string, string[]>;
    registry: MemberRegistry;
  }> {
    this.logService.debug("[DefaultReportGenerationService] Running health and mapping pipeline");

    return forkJoin({
      healthMap: this.cipherHealthService.checkCipherHealth(ciphers),
      mappingResult: this.memberCipherMappingService.mapCiphersToMembers$(
        ciphers,
        members,
        collectionAccess,
        groupMemberships,
      ),
    }).pipe(
      map(({ healthMap, mappingResult }) => ({
        ciphers,
        healthMap,
        memberMapping: mappingResult.mapping,
        registry: mappingResult.registry,
      })),
    );
  }

  /**
   * Aggregates ciphers into per-application reports
   *
   * Groups ciphers by trimmed URI and builds memberRefs/cipherRefs Records
   */
  private aggregateIntoReports(
    ciphers: CipherView[],
    healthMap: Map<string, any>,
    memberMapping: Map<string, string[]>,
  ): ApplicationHealthView[] {
    const applicationMap = this.groupCiphersByApplication(ciphers);

    const reports: ApplicationHealthView[] = [];

    applicationMap.forEach((cipherGroup, applicationName) => {
      const report = new ApplicationHealthView();
      report.applicationName = applicationName;

      const allMemberIds = new Set<string>();
      const atRiskMemberIds = new Set<string>();

      cipherGroup.forEach((cipher) => {
        const health = healthMap.get(cipher.id);
        const isAtRisk = health?.isAtRisk() ?? false;

        // Add cipher to cipherRefs Record
        report.cipherRefs[cipher.id] = isAtRisk;

        if (isAtRisk) {
          report.atRiskPasswordCount++;
        }

        // Get members who have access to this cipher
        const memberIds = memberMapping.get(cipher.id) ?? [];
        memberIds.forEach((memberId) => {
          allMemberIds.add(memberId);
          if (isAtRisk) {
            atRiskMemberIds.add(memberId);
          }
        });
      });

      // Build memberRefs Record from collected member IDs
      allMemberIds.forEach((memberId) => {
        report.memberRefs[memberId] = atRiskMemberIds.has(memberId);
      });

      // Set computed counts
      report.passwordCount = cipherGroup.length;
      report.memberCount = allMemberIds.size;
      report.atRiskMemberCount = atRiskMemberIds.size;

      // Pre-compute icon metadata from first cipher for display efficiency
      if (cipherGroup.length > 0) {
        const firstCipher = cipherGroup[0];
        report.iconCipherId = firstCipher.id;
        report.iconUri = CipherViewLikeUtils.uri(firstCipher) ?? applicationName;
      }

      reports.push(report);
    });

    return reports;
  }

  /**
   * Groups ciphers by trimmed URI (application name)
   */
  private groupCiphersByApplication(ciphers: CipherView[]): Map<string, CipherView[]> {
    const applicationMap = new Map<string, CipherView[]>();

    ciphers.forEach((cipher) => {
      const trimmedUris = getTrimmedCipherUris(cipher);

      trimmedUris.forEach((uri) => {
        const existing = applicationMap.get(uri) ?? [];
        existing.push(cipher);
        applicationMap.set(uri, existing);
      });
    });

    return applicationMap;
  }

  /**
   * Carries over application metadata from previous report
   *
   * Populates the view's applications array by matching report names with
   * previous application data, preserving critical flags and review dates.
   *
   * @param view - The view to populate with applications
   * @param previousApplications - Previous application metadata to carry over
   */
  private carryOverApplicationMetadata(
    view: AccessReportView,
    previousApplications: AccessReportSettingsView[],
  ): void {
    const previousMap = new Map(previousApplications.map((app) => [app.applicationName, app]));

    view.applications = view.reports.map((report) => {
      const previous = previousMap.get(report.applicationName);

      const app = new AccessReportSettingsView();
      app.applicationName = report.applicationName;
      app.isCritical = previous?.isCritical ?? false;
      app.reviewedDate = previous?.reviewedDate;

      return app;
    });
  }
}
