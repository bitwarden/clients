import {
  BehaviorSubject,
  catchError,
  forkJoin,
  from,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
  throwError,
} from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import type { ListResponse } from "@bitwarden/common/models/response/list.response";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

import { ReportProgress } from "../../../../reports/risk-insights/models/report-models";
import { AccessReportView } from "../../../models";
import { AccessIntelligenceDataService } from "../../abstractions/access-intelligence-data.service";
import {
  CollectionAccessDetails,
  GroupMembershipDetails,
  OrganizationUserView,
} from "../../abstractions/member-cipher-mapping.service";
import { ReportGenerationService } from "../../abstractions/report-generation.service";
import { ReportPersistenceService } from "../../abstractions/report-persistence.service";

/**
 * Default implementation of AccessIntelligenceDataService.
 *
 * Orchestrates data loading, report generation, and persistence for Access Intelligence.
 */
export class DefaultAccessIntelligenceDataService extends AccessIntelligenceDataService {
  private _report = new BehaviorSubject<AccessReportView | null>(null);
  private _ciphers = new BehaviorSubject<CipherView[]>([]);
  private _loading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);
  private _currentOrgId = new BehaviorSubject<OrganizationId | null>(null);
  private _reportProgress = new BehaviorSubject<ReportProgress | null>(null);

  readonly report$ = this._report.asObservable();
  readonly ciphers$ = this._ciphers.asObservable();
  readonly loading$ = this._loading.asObservable();
  readonly error$ = this._error.asObservable();
  readonly reportProgress$ = this._reportProgress.asObservable();

  constructor(
    private cipherService: CipherService,
    private organizationUserApiService: OrganizationUserApiService,
    private reportGenerationService: ReportGenerationService,
    private reportPersistenceService: ReportPersistenceService,
    private logService: LogService,
  ) {
    super();
  }

  initializeForOrganization$(orgId: OrganizationId): Observable<void> {
    this.logService.debug(
      "[DefaultAccessIntelligenceDataService] Initializing for organization",
      orgId,
    );

    // Reset state if switching organizations
    const previousOrgId = this._currentOrgId.value;
    if (previousOrgId && previousOrgId !== orgId) {
      this.resetState();
    }

    this._currentOrgId.next(orgId);
    this._loading.next(true);
    this._error.next(null);

    return this.reportPersistenceService.loadReport$(orgId).pipe(
      switchMap((result) => {
        if (!result) {
          return of(null);
        }

        const { report, hadLegacyBlobs } = result;

        if (hadLegacyBlobs) {
          this.logService.info(
            "[DefaultAccessIntelligenceDataService] Legacy blobs detected, re-saving in current format",
          );
          return this.reportPersistenceService.saveReport$(report, orgId).pipe(
            tap(({ id, contentEncryptionKey }) => {
              report.id = id;
              report.contentEncryptionKey = contentEncryptionKey;
              this.logService.info(
                "[DefaultAccessIntelligenceDataService] Legacy blobs re-saved in current format",
              );
            }),
            map(() => report),
          );
        }

        return of(report);
      }),
      switchMap((report) => {
        if (report) {
          this.logService.debug("[DefaultAccessIntelligenceDataService] Report loaded");
        } else {
          this.logService.debug("[DefaultAccessIntelligenceDataService] No reports found");
        }
        this._report.next(report);
        this._loading.next(false);
        return of(undefined as void);
      }),
      catchError((error: unknown) => {
        this.logService.error(
          "[DefaultAccessIntelligenceDataService] Initialization failed",
          error,
        );
        this._error.next("Failed to initialize");
        this._loading.next(false);
        this._report.next(null);
        return of(undefined as void);
      }),
    );
  }

  generateNewReport$(orgId: OrganizationId): Observable<void> {
    this.logService.debug(
      "[DefaultAccessIntelligenceDataService] Generating new report for organization",
      orgId,
    );

    this._loading.next(true);
    this._error.next(null);
    this._reportProgress.next(null); // Reset progress

    // Emit FetchingMembers before parallel data load begins
    this._reportProgress.next(ReportProgress.FetchingMembers);

    return forkJoin({
      previousReport: this._report.pipe(take(1)),
      orgData: this.loadOrganizationData$(orgId),
    }).pipe(
      switchMap(({ previousReport, orgData }) => {
        const previousApps = previousReport?.applications ?? [];
        // Transform API users to members, collection access, group memberships
        const { members, collectionAccess, groupMemberships } = this.transformOrganizationUserData(
          orgData.apiUsers.data,
        );

        this.logService.debug(
          "[DefaultAccessIntelligenceDataService] Organization data loaded and transformed",
          {
            cipherCount: orgData.ciphers.length,
            memberCount: members.length,
            collectionCount: collectionAccess.length,
            groupCount: groupMemberships.length,
          },
        );

        // Emit AnalyzingPasswords then CalculatingRisks before report generation
        this._reportProgress.next(ReportProgress.AnalyzingPasswords);
        this._reportProgress.next(ReportProgress.CalculatingRisks);

        // Generate report
        return this.reportGenerationService
          .generateReport(
            orgData.ciphers,
            members,
            collectionAccess,
            groupMemberships,
            previousApps,
          )
          .pipe(
            // Store ciphers for icon display and emit GeneratingReport after generation completes
            tap(() => {
              this._ciphers.next(orgData.ciphers);
              this._reportProgress.next(ReportProgress.GeneratingReport);
            }),
            // Save report
            switchMap((generatedReport) => {
              // Emit Saving before persistence call
              this._reportProgress.next(ReportProgress.Saving);
              return this.reportPersistenceService.saveReport$(generatedReport, orgId).pipe(
                map(({ id, contentEncryptionKey }) => {
                  generatedReport.id = id;
                  generatedReport.organizationId = orgId;
                  generatedReport.contentEncryptionKey = contentEncryptionKey;
                  return generatedReport;
                }),
              );
            }),
          );
      }),
      tap((savedReport) => {
        this._report.next(savedReport);
        this._reportProgress.next(ReportProgress.Complete);
        this._loading.next(false);
        this.logService.debug(
          "[DefaultAccessIntelligenceDataService] Report generation complete",
          savedReport.id,
        );
      }),
      map(() => undefined as void),
      catchError((error: unknown) => {
        this.logService.error(
          "[DefaultAccessIntelligenceDataService] Report generation failed",
          error,
        );
        this._error.next("Failed to generate report");
        this._reportProgress.next(null); // Reset progress on error
        this._loading.next(false);
        return throwError(() => error);
      }),
    );
  }

  loadExistingReport$(orgId: OrganizationId): Observable<void> {
    this.logService.debug(
      "[DefaultAccessIntelligenceDataService] Loading existing report for organization",
      orgId,
    );

    this._loading.next(true);
    this._error.next(null);

    return this.reportPersistenceService.loadReport$(orgId).pipe(
      tap((result) => {
        this._report.next(result?.report ?? null);
        this._loading.next(false);
        this.logService.debug(
          "[DefaultAccessIntelligenceDataService] Load complete",
          result ? "Report loaded" : "No existing report",
        );
      }),
      map(() => undefined as void),
      catchError((error: unknown) => {
        this.logService.error("[DefaultAccessIntelligenceDataService] Load failed", error);
        this._error.next("Failed to load report");
        this._loading.next(false);
        return throwError(() => error);
      }),
    );
  }

  refreshReport$(orgId: OrganizationId): Observable<void> {
    this.logService.debug(
      "[DefaultAccessIntelligenceDataService] Refreshing report for organization",
      orgId,
    );

    // Refresh is the same as generate - both load latest data
    return this.generateNewReport$(orgId);
  }

  markApplicationsAsCritical$(appNames: string[]): Observable<void> {
    const report = this._report.value;
    if (!report) {
      return throwError(() => new Error("No report loaded"));
    }

    if (appNames.length === 0) {
      return of(undefined as void);
    }

    this.logService.debug(
      "[DefaultAccessIntelligenceDataService] Marking applications as critical",
      appNames,
    );

    // Save previous states for rollback
    const previousStates = appNames.map((appName) => {
      const existingApp = report.applications.find((a) => a.applicationName === appName);
      return {
        appName,
        isCritical: existingApp?.isCritical ?? false,
        reviewedDate: existingApp?.reviewedDate,
      };
    });

    // Mutate all apps at once (single recomputeSummary call)
    report.markApplicationsAsCritical(appNames);

    // Persist once
    return this.reportPersistenceService.saveApplicationMetadata$(report).pipe(
      tap(() => {
        this._report.next(report);
        this.logService.debug(
          "[DefaultAccessIntelligenceDataService] Applications marked as critical",
          appNames,
        );
      }),
      map(() => undefined as void),
      catchError((error: unknown) => {
        this.logService.error(
          "[DefaultAccessIntelligenceDataService] Failed to mark applications as critical",
          error,
        );

        // Rollback all mutations then recompute summary once
        previousStates.forEach(({ appName, isCritical, reviewedDate }) => {
          const app = report.applications.find((a) => a.applicationName === appName);
          if (app) {
            app.isCritical = isCritical;
            app.reviewedDate = reviewedDate;
          }
        });
        report.recomputeSummary();
        this._report.next(report);

        this._error.next("Failed to mark applications as critical");
        return throwError(() => error);
      }),
    );
  }

  unmarkApplicationsAsCritical$(appNames: string[]): Observable<void> {
    const report = this._report.value;
    if (!report) {
      return throwError(() => new Error("No report loaded"));
    }

    if (appNames.length === 0) {
      return of(undefined as void);
    }

    this.logService.debug(
      "[DefaultAccessIntelligenceDataService] Unmarking applications as critical",
      appNames,
    );

    // Save previous states for rollback
    const previousStates = appNames.map((appName) => ({
      appName,
      isCritical:
        report.applications.find((a) => a.applicationName === appName)?.isCritical ?? false,
    }));

    // Mutate all apps at once (single recomputeSummary call)
    report.unmarkApplicationsAsCritical(appNames);

    // Persist once
    return this.reportPersistenceService.saveApplicationMetadata$(report).pipe(
      tap(() => {
        this._report.next(report);
        this.logService.debug(
          "[DefaultAccessIntelligenceDataService] Applications unmarked as critical",
          appNames,
        );
      }),
      map(() => undefined as void),
      catchError((error: unknown) => {
        this.logService.error(
          "[DefaultAccessIntelligenceDataService] Failed to unmark applications as critical",
          error,
        );

        // Rollback all mutations then recompute summary once
        previousStates.forEach(({ appName, isCritical }) => {
          const app = report.applications.find((a) => a.applicationName === appName);
          if (app) {
            app.isCritical = isCritical;
          }
        });
        report.recomputeSummary();
        this._report.next(report);

        this._error.next("Failed to unmark applications as critical");
        return throwError(() => error);
      }),
    );
  }

  markApplicationsAsReviewed$(appNames: string[], date?: Date): Observable<void> {
    const report = this._report.value;
    if (!report) {
      return throwError(() => new Error("No report loaded"));
    }

    if (appNames.length === 0) {
      return of(undefined as void);
    }

    this.logService.debug(
      "[DefaultAccessIntelligenceDataService] Marking applications as reviewed",
      appNames,
    );

    // Save previous states for rollback
    const previousStates = appNames.map((appName) => ({
      appName,
      reviewedDate: report.applications.find((a) => a.applicationName === appName)?.reviewedDate,
    }));

    // Mutate all apps at once
    appNames.forEach((name) => report.markApplicationAsReviewed(name, date));

    // Persist once
    return this.reportPersistenceService.saveApplicationMetadata$(report).pipe(
      tap(() => {
        this._report.next(report);
        this.logService.debug(
          "[DefaultAccessIntelligenceDataService] Applications marked as reviewed",
          appNames,
        );
      }),
      map(() => undefined as void),
      catchError((error: unknown) => {
        this.logService.error(
          "[DefaultAccessIntelligenceDataService] Failed to mark applications as reviewed",
          error,
        );

        // Rollback all mutations
        previousStates.forEach(({ appName, reviewedDate }) => {
          const app = report.applications.find((a) => a.applicationName === appName);
          if (app) {
            app.reviewedDate = reviewedDate;
          }
        });
        this._report.next(report);

        this._error.next("Failed to mark applications as reviewed");
        return throwError(() => error);
      }),
    );
  }

  /**
   * Load organization data in parallel (ciphers and users with collections/groups)
   */
  private loadOrganizationData$(orgId: OrganizationId): Observable<{
    ciphers: CipherView[];
    apiUsers: ListResponse<OrganizationUserUserDetailsResponse>;
  }> {
    return forkJoin({
      ciphers: from(this.cipherService.getAllFromApiForOrganization(orgId)),
      apiUsers: from(
        this.organizationUserApiService.getAllUsers(orgId, {
          includeCollections: true,
          includeGroups: true,
        }),
      ),
    });
  }

  /**
   * Transform organization user data from API format to service format
   *
   * Inverts user→collections/groups mappings to collection→users and group→users
   * for use by MemberCipherMappingService.
   */
  private transformOrganizationUserData(apiUsers: OrganizationUserUserDetailsResponse[]): {
    members: OrganizationUserView[];
    collectionAccess: CollectionAccessDetails[];
    groupMemberships: GroupMembershipDetails[];
  } {
    // 1. Extract members (simple mapping)
    const members: OrganizationUserView[] = apiUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));

    // 2. Invert user→collections to collection→users/groups
    const collectionMap = new Map<string, { users: Set<string>; groups: Set<string> }>();

    apiUsers.forEach((user) => {
      // For each collection the user has access to, add the user
      user.collections?.forEach((collection: { id: string }) => {
        if (!collectionMap.has(collection.id)) {
          collectionMap.set(collection.id, { users: new Set(), groups: new Set() });
        }
        collectionMap.get(collection.id)!.users.add(user.id);
      });
    });

    // Note: Groups that grant collection access are handled implicitly:
    // If a user is in a group that has collection access, the user.collections
    // array already includes those collections (server-side expansion)

    const collectionAccess: CollectionAccessDetails[] = Array.from(collectionMap.entries()).map(
      ([collectionId, access]) => ({
        collectionId,
        users: access.users,
        groups: access.groups, // May be empty if server expands groups to users
      }),
    );

    // 3. Invert user→groups to group→users
    const groupMap = new Map<string, Set<string>>();

    apiUsers.forEach((user) => {
      user.groups?.forEach((groupId: string) => {
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, new Set());
        }
        groupMap.get(groupId)!.add(user.id);
      });
    });

    const groupMemberships: GroupMembershipDetails[] = Array.from(groupMap.entries()).map(
      ([groupId, users]) => ({ groupId, users }),
    );

    return { members, collectionAccess, groupMemberships };
  }

  /**
   * Reset state when switching organizations
   */
  private resetState(): void {
    this.logService.debug("[DefaultAccessIntelligenceDataService] Resetting state for org switch");
    this._report.next(null);
    this._ciphers.next([]);
    this._error.next(null);
    this._loading.next(false);
    this._reportProgress.next(null);
  }
}
