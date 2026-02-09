import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  from,
  merge,
  Observable,
  of,
  Subject,
  Subscription,
  throwError,
} from "rxjs";
import {
  catchError,
  distinctUntilChanged,
  exhaustMap,
  filter,
  map,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs/operators";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { LogService } from "@bitwarden/logging";

import {
  buildPasswordUseMap,
  flattenMemberDetails,
  getTrimmedCipherUris,
  getUniqueMembers,
} from "../../helpers";
import {
  ApplicationHealthReportDetailEnriched,
  PasswordHealthReportApplicationsResponse,
} from "../../models";
import { RiskInsightsEnrichedData } from "../../models/report-data-service.types";
import {
  CipherHealthReport,
  MemberDetails,
  OrganizationReportApplication,
  ReportStatus,
  ReportState,
  ReportProgress,
  ApplicationHealthReportDetail,
} from "../../models/report-models";
import { MemberCipherDetailsApiService } from "../api/member-cipher-details-api.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { CriticalAppsService } from "./critical-apps.service";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";
import { RiskInsightsSaveService } from "./risk-insights-save.service";

/**
 * Internal interface for organization data needed for V2 member mapping
 */
interface OrganizationDataV2 {
  collectionMap: Map<string, CollectionAdminView>;
  groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>;
  userEmailMap: Map<string, string>;
}

/**
 * Internal interface for member access info (V2)
 */
interface CipherMemberAccessInfoV2 {
  userId: string;
  email: string | null;
  accessType: "direct" | "group";
  collectionId: string;
  collectionName: string;
  canEdit: boolean;
  canViewPasswords: boolean;
  canManage: boolean;
  groupId?: string;
  groupName?: string;
}

export class RiskInsightsOrchestratorService {
  private _destroy$ = new Subject<void>();

  // -------------------------- Context state --------------------------
  // Current user viewing risk insights
  private _userIdSubject = new BehaviorSubject<UserId | null>(null);
  private _userId$ = this._userIdSubject.asObservable();

  // Organization the user is currently viewing
  private _organizationDetailsSubject = new BehaviorSubject<{
    organizationId: OrganizationId;
    organizationName: string;
  } | null>(null);
  organizationDetails$ = this._organizationDetailsSubject.asObservable();

  // ------------------------- Cipher data -------------------------
  private _ciphersSubject = new BehaviorSubject<CipherView[] | null>(null);
  private _ciphers$ = this._ciphersSubject.asObservable();

  private _hasCiphersSubject$ = new BehaviorSubject<boolean | null>(null);
  hasCiphers$ = this._hasCiphersSubject$.asObservable();

  private _criticalApplicationAtRiskCipherIdsSubject$ = new BehaviorSubject<CipherId[]>([]);
  readonly criticalApplicationAtRiskCipherIds$ =
    this._criticalApplicationAtRiskCipherIdsSubject$.asObservable();

  // ------------------------- Report Variables ----------------
  private _rawReportDataSubject = new BehaviorSubject<ReportState>({
    status: ReportStatus.Initializing,
    error: null,
    data: null,
  });
  rawReportData$ = this._rawReportDataSubject.asObservable();
  private _enrichedReportDataSubject = new BehaviorSubject<RiskInsightsEnrichedData | null>(null);
  enrichedReportData$ = this._enrichedReportDataSubject.asObservable();

  // New applications that haven't been reviewed (reviewedDate === null)
  newApplications$: Observable<ApplicationHealthReportDetail[]> = this.rawReportData$.pipe(
    map((reportState) => {
      const reportApplications = reportState.data?.applicationData || [];

      const newApplications =
        reportState?.data?.reportData.filter((reportApp) =>
          reportApplications.some(
            (app) => app.applicationName == reportApp.applicationName && app.reviewedDate == null,
          ),
        ) || [];
      return newApplications;
    }),
    distinctUntilChanged((prev, curr) => {
      if (prev.length !== curr.length) {
        return false;
      }
      return prev.every(
        (app, i) =>
          app.applicationName === curr[i].applicationName &&
          app.atRiskPasswordCount === curr[i].atRiskPasswordCount,
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Generate report trigger and state
  private _generateReportTriggerSubject = new BehaviorSubject<boolean>(false);
  generatingReport$ = this._generateReportTriggerSubject.asObservable();

  // Report generation progress
  private _reportProgressSubject = new BehaviorSubject<ReportProgress | null>(null);
  reportProgress$ = this._reportProgressSubject.asObservable();

  // --------------------------- Critical Application data ---------------------
  private _criticalReportResultsSubject = new BehaviorSubject<RiskInsightsEnrichedData | null>(
    null,
  );
  criticalReportResults$ = this._criticalReportResultsSubject.asObservable();

  // --------------------------- Trigger subjects ---------------------
  private _initializeOrganizationTriggerSubject = new Subject<OrganizationId>();
  private _flagForUpdatesSubject = new Subject<ReportState>();
  private _flagForUpdates$ = this._flagForUpdatesSubject.asObservable();

  private _reportStateSubscription: Subscription | null = null;
  private _migrationSubscription: Subscription | null = null;

  constructor(
    private accountService: AccountService,
    private cipherService: CipherService,
    private collectionAdminService: CollectionAdminService,
    private criticalAppsService: CriticalAppsService,
    private logService: LogService,
    private memberCipherDetailsApiService: MemberCipherDetailsApiService,
    private organizationService: OrganizationService,
    private organizationUserApiService: OrganizationUserApiService,
    private passwordHealthService: PasswordHealthService,
    private reportApiService: RiskInsightsApiService,
    private reportService: RiskInsightsReportService,
    private saveService: RiskInsightsSaveService,
  ) {
    this.logService.debug("[RiskInsightsOrchestratorService] Setting up");
    this._setupCriticalApplicationContext();
    this._setupCriticalApplicationReport();
    this._setupEnrichedReportData();
    this._setupInitializationPipeline();
    this._setupMigrationAndCleanup();
    this._setupReportState();
    this._setupUserId();
  }

  destroy(): void {
    this.logService.debug("[RiskInsightsOrchestratorService] Destroying");
    if (this._reportStateSubscription) {
      this._reportStateSubscription.unsubscribe();
    }
    if (this._migrationSubscription) {
      this._migrationSubscription.unsubscribe();
    }
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Generates a new report for the current organization and user
   */
  generateReport(): void {
    this.logService.debug("[RiskInsightsOrchestratorService] Create new report triggered");
    this._generateReportTriggerSubject.next(true);
  }

  /**
   * Gets the cipher icon for a given cipher ID
   *
   * @param cipherId The ID of the cipher to get the icon for
   * @returns A CipherViewLike if found, otherwise undefined
   */
  getCipherIcon(cipherId: string): CipherViewLike | undefined {
    const currentCiphers = this._ciphersSubject.value;
    if (!currentCiphers) {
      return undefined;
    }

    const foundCipher = currentCiphers.find((c) => c.id === cipherId);

    return foundCipher;
  }

  /**
   * Initializes the service context for a specific organization
   *
   * @param organizationId The ID of the organization to initialize context for
   */
  initializeForOrganization(organizationId: OrganizationId) {
    this.logService.debug("[RiskInsightsOrchestratorService] Initializing for org", organizationId);
    this._initializeOrganizationTriggerSubject.next(organizationId);
  }

  /**
   * Removes a critical application from a report.
   *
   * @param criticalApplication Application name of the critical application to remove
   * @returns
   */
  removeCriticalApplication$(criticalApplication: string): Observable<ReportState> {
    this.logService.info(
      "[RiskInsightsOrchestratorService] Removing critical applications from report",
    );
    return this.rawReportData$.pipe(
      take(1),
      filter((data) => data.status != ReportStatus.Loading && data.data != null),
      withLatestFrom(
        this.organizationDetails$.pipe(filter((org) => !!org && !!org.organizationId)),
        this._userId$.pipe(filter((userId) => !!userId)),
      ),
      map(([reportState, organizationDetails, userId]) => {
        const report = reportState?.data;
        if (!report) {
          throw new Error("Tried to update critical applications without a report");
        }

        // Prepare updated application data with critical flag removed
        const existingApplicationData = report.applicationData || [];
        const updatedApplicationData = this._removeCriticalApplication(
          existingApplicationData,
          criticalApplication,
        );

        return { reportState, organizationDetails, userId, updatedApplicationData };
      }),

      switchMap(({ reportState, organizationDetails, userId, updatedApplicationData }) =>
        this.saveService
          .saveReportUpdates$({
            reportState,
            organizationDetails: organizationDetails!,
            userId: userId!,
            updatedApplicationData,
          })
          .pipe(
            map(({ updatedState }) => updatedState),
            tap((finalState) => {
              this._validateSaveConsistency(finalState, "remove");
              this._flagForUpdatesSubject.next(finalState);
            }),
            catchError((error: unknown) => {
              this.logService.error("Failed to save remove critical application", error);
              return of({ ...reportState, error: "Failed to remove a critical application" });
            }),
          ),
      ),
    );
  }

  saveCriticalApplications$(criticalApplications: string[]): Observable<ReportState> {
    this.logService.info(
      "[RiskInsightsOrchestratorService] Saving critical applications to report",
    );
    return this.rawReportData$.pipe(
      take(1),
      filter((data) => data.status != ReportStatus.Loading && data.data != null),
      withLatestFrom(
        this.organizationDetails$.pipe(filter((org) => !!org && !!org.organizationId)),
        this._userId$.pipe(filter((userId) => !!userId)),
      ),
      map(([reportState, organizationDetails, userId]) => {
        const report = reportState?.data;
        if (!report) {
          throw new Error("Tried to update critical applications without a report");
        }

        // Prepare updated application data with critical flags
        const newCriticalAppNamesSet = criticalApplications.map((ca) => ({
          applicationName: ca,
          isCritical: true,
        }));
        const existingApplicationData = report.applicationData || [];
        const updatedApplicationData = this._updateApplicationData(
          existingApplicationData,
          newCriticalAppNamesSet,
        );

        return { reportState, organizationDetails, userId, updatedApplicationData };
      }),

      switchMap(({ reportState, organizationDetails, userId, updatedApplicationData }) =>
        this.saveService
          .saveReportUpdates$({
            reportState,
            organizationDetails: organizationDetails!,
            userId: userId!,
            updatedApplicationData,
          })
          .pipe(
            map(({ updatedState }) => updatedState),
            tap((finalState) => {
              this._validateSaveConsistency(finalState, "critical");
              this._flagForUpdatesSubject.next(finalState);
            }),
            catchError((error: unknown) => {
              this.logService.error("Failed to save critical applications", error);
              return of({ ...reportState, error: "Failed to save critical applications" });
            }),
          ),
      ),
    );
  }

  /**
   * Saves review status for new applications and optionally marks
   * selected ones as critical
   *
   * @param reviewedApplications Array of application names to mark as reviewed
   * @returns Observable of updated ReportState
   */
  saveApplicationReviewStatus$(
    reviewedApplications: OrganizationReportApplication[],
  ): Observable<ReportState> {
    this.logService.info(
      `[RiskInsightsOrchestratorService] Saving application review status for ${reviewedApplications.length} applications`,
    );

    return this.rawReportData$.pipe(
      take(1),
      filter((data) => data.status != ReportStatus.Loading && data.data != null),
      withLatestFrom(
        this.organizationDetails$.pipe(filter((org) => !!org && !!org.organizationId)),
        this._userId$.pipe(filter((userId) => !!userId)),
      ),
      map(([reportState, organizationDetails, userId]) => {
        const report = reportState?.data;
        if (!report) {
          throw new Error("Tried save reviewed applications without a report");
        }

        // Prepare updated application data with review status
        const existingApplicationData = report.applicationData || [];
        const updatedApplicationData = this._updateApplicationData(
          existingApplicationData,
          reviewedApplications,
        );

        this.logService.debug("[RiskInsightsOrchestratorService] Updated review status", {
          totalApps: updatedApplicationData.length,
          reviewedApps: updatedApplicationData.filter((app) => app.reviewedDate !== null).length,
          criticalApps: updatedApplicationData.filter((app) => app.isCritical).length,
        });

        return { reportState, organizationDetails, userId, updatedApplicationData };
      }),

      switchMap(({ reportState, organizationDetails, userId, updatedApplicationData }) =>
        this.saveService
          .saveReportUpdates$({
            reportState,
            organizationDetails: organizationDetails!,
            userId: userId!,
            updatedApplicationData,
          })
          .pipe(
            map(({ updatedState }) => updatedState),
            tap((finalState) => {
              this._validateSaveConsistency(finalState, "review");
              this._flagForUpdatesSubject.next(finalState);
            }),
            catchError((error: unknown) => {
              this.logService.error(
                "[RiskInsightsOrchestratorService] Failed to save review status",
                error,
              );
              return of({ ...reportState, error: "Failed to save application review status" });
            }),
          ),
      ),
    );
  }

  private _fetchReport$(organizationId: OrganizationId, userId: UserId): Observable<ReportState> {
    return this.reportService.getRiskInsightsReport$(organizationId, userId).pipe(
      tap(() => this.logService.debug("[RiskInsightsOrchestratorService] Fetching report")),
      map((result): ReportState => {
        return {
          status: ReportStatus.Complete,
          error: null,
          data: result,
        };
      }),
      catchError((error: unknown) => {
        this.logService.error("[RiskInsightsOrchestratorService] Failed to fetch report", error);
        return of({
          status: ReportStatus.Error,
          error: "Failed to fetch report",
          data: null,
          organizationId,
        });
      }),
    );
  }

  // ==================== V1 METHODS - DEPRECATED ====================
  // These methods are kept for rollback purposes only and will be removed after V2 is verified stable.
  // DO NOT use these methods - see V2 methods below instead.

  /**
   * @deprecated V1 implementation kept for rollback only. Use _generateNewApplicationsReportV2$ instead.
   * This version uses backend getMemberCipherDetails which causes timeouts on large organizations.
   * Will be removed after V2 is verified stable in production.
   */
  private _generateNewApplicationsReport$(
    organizationId: OrganizationId,
    userId: UserId,
  ): Observable<ReportState> {
    // Reset progress and performance tracking
    this._reportProgressSubject.next(null);

    this.logService.debug("[RiskInsightsOrchestratorService] Fetching member cipher details");
    this._reportProgressSubject.next(ReportProgress.FetchingMembers);

    // Generate the report - fetch member ciphers and org ciphers in parallel
    const memberCiphers$ = from(
      this.memberCipherDetailsApiService.getMemberCipherDetails(organizationId),
    ).pipe(
      map((memberCiphers) => flattenMemberDetails(memberCiphers)),
      catchError((error: unknown) => {
        this.logService.error(
          "[RiskInsightsOrchestratorService] Failed to fetch member cipher details - this is likely a timeout or backend cartesian product issue",
          error,
        );
        // Re-throw to trigger the outer catchError and show proper error state
        return throwError(
          () =>
            new Error(
              "Failed to fetch member cipher details. This organization may be too large for the current backend implementation.",
            ),
        );
      }),
    );

    // Start the generation pipeline
    const reportGeneration$ = forkJoin([this._ciphers$.pipe(take(1)), memberCiphers$]).pipe(
      tap(([ciphers, memberCiphers]) => {
        this.logService.debug(
          `[RiskInsightsOrchestratorService] Data fetch complete - Ciphers: ${ciphers?.length ?? 0}, Members: ${memberCiphers.length}`,
        );
      }),
      switchMap(([ciphers, memberCiphers]) => {
        this.logService.debug("[RiskInsightsOrchestratorService] Analyzing password health");
        this._reportProgressSubject.next(ReportProgress.AnalyzingPasswords);
        return forkJoin({
          memberDetails: of(memberCiphers),
          cipherHealthReports: this._getCipherHealth(ciphers ?? [], memberCiphers),
        }).pipe(
          tap(({ cipherHealthReports }) => {
            this.logService.debug(
              `[RiskInsightsOrchestratorService] Password analysis complete - Health reports: ${cipherHealthReports.length}`,
            );
          }),
          map(({ memberDetails, cipherHealthReports }) => {
            const uniqueMembers = getUniqueMembers(memberDetails);
            const totalMemberCount = uniqueMembers.length;

            return { cipherHealthReports, totalMemberCount };
          }),
        );
      }),
      map(({ cipherHealthReports, totalMemberCount }) => {
        this.logService.debug("[RiskInsightsOrchestratorService] Calculating risk scores");
        this._reportProgressSubject.next(ReportProgress.CalculatingRisks);
        const report = this.reportService.generateApplicationsReport(cipherHealthReports);
        return { report, totalMemberCount };
      }),
      tap(() => {
        this.logService.debug("[RiskInsightsOrchestratorService] Generating report data");
        this._reportProgressSubject.next(ReportProgress.GeneratingReport);
      }),
      withLatestFrom(this.rawReportData$),
      map(([{ report, totalMemberCount }, previousReport]) => {
        // Update the application data
        const updatedApplicationData = this.reportService.getOrganizationApplications(
          report,
          previousReport?.data?.applicationData ?? [],
        );

        const manualEnrichedApplications = report.map(
          (application): ApplicationHealthReportDetailEnriched => ({
            ...application,
            isMarkedAsCritical: this.reportService.isCriticalApplication(
              application,
              updatedApplicationData,
            ),
          }),
        );

        const updatedSummary = this.reportService.getApplicationsSummary(
          report,
          updatedApplicationData,
          totalMemberCount,
        );
        // For now, merge the report with the critical marking flag to make the enriched type
        // We don't care about the individual ciphers in this instance
        // After the report and enriched report types are consolidated, this mapping can be removed
        // and the class will expose getCriticalApplications
        const metrics = this.reportService.getReportMetrics(
          manualEnrichedApplications,
          updatedSummary,
        );

        return {
          report,
          summary: updatedSummary,
          applications: updatedApplicationData,
          metrics,
        };
      }),
      switchMap(({ report, summary, applications, metrics }) => {
        this.logService.debug(
          "[RiskInsightsOrchestratorService] Encrypting and compressing report data",
        );
        this._reportProgressSubject.next(ReportProgress.EncryptingData);
        return this.reportService
          .saveRiskInsightsReport$(report, summary, applications, metrics, {
            organizationId,
            userId,
          })
          .pipe(
            tap(() => {
              this.logService.debug("[RiskInsightsOrchestratorService] Uploading report");
              this._reportProgressSubject.next(ReportProgress.Saving);
            }),
            map((result) => ({
              report,
              summary,
              applications,
              id: result.response.id,
              contentEncryptionKey: result.contentEncryptionKey,
            })),
          );
      }),
      // Update the running state
      tap(() => {
        this.logService.debug("[RiskInsightsOrchestratorService] Report generation complete");
        this._reportProgressSubject.next(ReportProgress.Complete);
      }),
      map((mappedResult): ReportState => {
        const { id, report, summary, applications, contentEncryptionKey } = mappedResult;
        return {
          status: ReportStatus.Complete,
          error: null,
          data: {
            id,
            reportData: report,
            summaryData: summary,
            applicationData: applications,
            creationDate: new Date(),
            contentEncryptionKey,
          },
        };
      }),
      catchError((error: unknown): Observable<ReportState> => {
        this.logService.error("[RiskInsightsOrchestratorService] Report generation failed", error);

        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate or save report";

        return of({
          status: ReportStatus.Error,
          error: errorMessage,
          data: null,
        });
      }),
      startWith<ReportState>({
        status: ReportStatus.Loading,
        error: null,
        data: null,
      }),
    ) as Observable<ReportState>;

    return reportGeneration$;
  }

  /**
   * Associates members with ciphers they have access to and calculates password health
   *
   * @param ciphers Organization ciphers
   * @param memberDetails Organization member details
   * @returns Cipher password health data with trimmed URIs and associated members
   */
  private _getCipherHealth(
    ciphers: CipherView[],
    memberDetails: MemberDetails[],
  ): Observable<CipherHealthReport[]> {
    const validCiphers = ciphers.filter((cipher) =>
      this.passwordHealthService.isValidCipher(cipher),
    );

    const passwordUseMap = buildPasswordUseMap(validCiphers);

    // Check for exposed passwords and map to cipher health report
    return this.passwordHealthService.auditPasswordLeaks$(validCiphers).pipe(
      map((exposedDetails) => {
        // Pre-build a map of cipherId → members to avoid O(n²) filter loop
        // This reduces 10,000 × 50,000 filter operations to a single O(n) grouping pass
        const cipherMembersMap = new Map<string, MemberDetails[]>();
        for (const member of memberDetails) {
          const existing = cipherMembersMap.get(member.cipherId);
          if (existing) {
            existing.push(member);
          } else {
            cipherMembersMap.set(member.cipherId, [member]);
          }
        }

        return validCiphers.map((cipher) => {
          const exposedPasswordDetail = exposedDetails.find((x) => x?.cipherId === cipher.id);
          const cipherMembers = cipherMembersMap.get(cipher.id) ?? []; // O(1) lookup instead of O(n) filter
          const applications = getTrimmedCipherUris(cipher);
          const weakPasswordDetail = this.passwordHealthService.findWeakPasswordDetails(cipher);
          const reusedPasswordCount = passwordUseMap.get(cipher.login.password!) ?? 0;
          return {
            cipher,
            cipherMembers,
            applications,
            healthData: {
              weakPasswordDetail,
              reusedPasswordCount,
              exposedPasswordDetail,
            },
          } as CipherHealthReport;
        });
      }),
    );
  }

  /**
   * Updates existing application data to include critical applications
   * Does not remove critical applications that are not in the update set
   */
  private _updateApplicationData(
    existingApplications: OrganizationReportApplication[],
    updatedApplications: (Partial<OrganizationReportApplication> & { applicationName: string })[],
  ): OrganizationReportApplication[] {
    const arrayToMerge = [...updatedApplications];

    const updatedApps = existingApplications.map((app) => {
      // Check if there is an updated app
      const foundUpdatedIndex = arrayToMerge.findIndex(
        (ua) => ua.applicationName == app.applicationName,
      );

      let foundApp: Partial<OrganizationReportApplication> | null = null;
      // Remove the updated app from the list
      if (foundUpdatedIndex >= 0) {
        foundApp = arrayToMerge[foundUpdatedIndex];
        arrayToMerge.splice(foundUpdatedIndex, 1);
      }
      return {
        applicationName: app.applicationName,
        isCritical: foundApp?.isCritical || app.isCritical,
        reviewedDate: foundApp?.reviewedDate || app.reviewedDate,
      };
    });

    const newElements: OrganizationReportApplication[] = arrayToMerge.map(
      (newApp): OrganizationReportApplication => ({
        applicationName: newApp.applicationName,
        isCritical: newApp.isCritical ?? false,
        reviewedDate: null,
      }),
    );

    return updatedApps.concat(newElements);
  }

  /**
   * Toggles the isCritical flag off for a specific application
   */
  private _removeCriticalApplication(
    applicationData: OrganizationReportApplication[],
    criticalApplication: string,
  ): OrganizationReportApplication[] {
    const updatedApplicationData = applicationData.map((application) => {
      if (application.applicationName == criticalApplication) {
        return { ...application, isCritical: false } as OrganizationReportApplication;
      }
      return application;
    });
    return updatedApplicationData;
  }

  /**
   * Migrates legacy critical apps from old storage to new report-based storage
   * Cleans up old critical apps after successful migration
   */
  private _runMigrationAndCleanup$(criticalApps: PasswordHealthReportApplicationsResponse[]) {
    return of(criticalApps).pipe(
      withLatestFrom(this.organizationDetails$),
      switchMap(([savedCriticalApps, organizationDetails]) => {
        // No saved critical apps for migration
        if (!savedCriticalApps || savedCriticalApps.length === 0) {
          this.logService.debug("[RiskInsightsOrchestratorService] No critical apps to migrate.");
          return of([]);
        }

        const criticalAppsNames = savedCriticalApps.map((app) => app.uri);
        const criticalAppsIds = savedCriticalApps.map((app) => app.id);

        // Use the setCriticalApplications$ function to update and save the report
        return this.saveCriticalApplications$(criticalAppsNames).pipe(
          // After setCriticalApplications$ completes, trigger the deletion.
          switchMap(() => {
            return this.criticalAppsService
              .dropCriticalAppsById(organizationDetails!.organizationId, criticalAppsIds)
              .pipe(
                // After all deletes complete, map to the migrated apps.
                tap(() => {
                  this.logService.debug(
                    "[RiskInsightsOrchestratorService] Migrated and deleted critical applications.",
                  );
                }),
              );
          }),
          catchError((error: unknown) => {
            this.logService.error(
              "[RiskInsightsOrchestratorService] Failed to save migrated critical applications",
              error,
            );
            return throwError(() => error);
          }),
        );
      }),
    );
  }

  /**
   * Sets up the pipeline to load critical applications when organization or user changes
   */
  private _setupCriticalApplicationContext() {
    this.organizationDetails$
      .pipe(
        filter((orgDetails) => !!orgDetails),
        withLatestFrom(this._userId$),
        filter(([_, userId]) => !!userId),
        tap(([orgDetails, userId]) => {
          this.logService.debug(
            "[RiskInsightsOrchestratorService] Loading critical applications for org",
            orgDetails!.organizationId,
          );
          this.criticalAppsService.loadOrganizationContext(orgDetails!.organizationId, userId!);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  /**
   * Sets up the pipeline to create a report view filtered to only critical applications
   */
  private _setupCriticalApplicationReport() {
    const criticalReportResultsPipeline$ = this.enrichedReportData$.pipe(
      filter((state) => !!state && !!state.summaryData),
      map((enrichedReports) => {
        const criticalApplications = enrichedReports!.reportData.filter(
          (app) => app.isMarkedAsCritical,
        );
        // Generate a new summary based on just the critical applications
        const summary = this.reportService.getApplicationsSummary(
          criticalApplications,
          enrichedReports!.applicationData,
          enrichedReports!.summaryData.totalMemberCount,
        );
        return {
          ...enrichedReports!,
          summaryData: summary,
          reportData: criticalApplications,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    criticalReportResultsPipeline$.pipe(takeUntil(this._destroy$)).subscribe((data) => {
      this._criticalReportResultsSubject.next(data);
    });
  }

  /**
   * Takes the basic application health report details and enriches them to include
   * critical app status and associated ciphers.
   */
  private _setupEnrichedReportData() {
    // Setup the enriched report data pipeline
    const enrichmentSubscription = combineLatest([this.rawReportData$]).pipe(
      switchMap(([rawReportData]) => {
        this.logService.debug(
          "[RiskInsightsOrchestratorService] Enriching report data with ciphers and critical app status",
        );
        const criticalAppsData =
          rawReportData?.data?.applicationData.filter((app) => app.isCritical) ?? [];
        const rawReports = rawReportData.data?.reportData || [];

        const enrichedReports: ApplicationHealthReportDetailEnriched[] = rawReports.map((app) => ({
          ...app,
          isMarkedAsCritical: this.reportService.isCriticalApplication(app, criticalAppsData),
        }));

        const enrichedData = {
          ...rawReportData.data,
          reportData: enrichedReports,
        } as RiskInsightsEnrichedData;

        return of(enrichedData);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    enrichmentSubscription.pipe(takeUntil(this._destroy$)).subscribe((enrichedData) => {
      this._enrichedReportDataSubject.next(enrichedData);
    });
  }

  /**
   * Sets up the pipeline to initialize organization context when organization changes
   */
  private _setupInitializationPipeline() {
    this._initializeOrganizationTriggerSubject
      .pipe(
        withLatestFrom(this._userId$),
        filter(([orgId, userId]) => !!orgId && !!userId),
        switchMap(([orgId, userId]) =>
          this.organizationService.organizations$(userId!).pipe(
            getOrganizationById(orgId),
            map((org) => ({ organizationId: orgId!, organizationName: org?.name ?? "" })),
          ),
        ),
        tap(async (orgDetails) => {
          this.logService.debug("[RiskInsightsOrchestratorService] Fetching organization ciphers");
          const ciphers = await this.cipherService.getAllFromApiForOrganization(
            orgDetails.organizationId,
            true,
          );
          this._ciphersSubject.next(ciphers);
          this._hasCiphersSubject$.next(ciphers.length > 0);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe((orgDetails) => this._organizationDetailsSubject.next(orgDetails));
  }

  /**
   * Sets up migration pipeline for legacy critical apps
   * Runs once when both critical apps and report data are available
   */
  private _setupMigrationAndCleanup() {
    const criticalApps$ = this.criticalAppsService.criticalAppsList$.pipe(
      filter((criticalApps) => criticalApps.length > 0),
      take(1),
    );

    const rawReportData$ = this.rawReportData$.pipe(
      filter((reportState) => !!reportState.data),
      take(1),
    );

    this._migrationSubscription = forkJoin([criticalApps$, rawReportData$])
      .pipe(
        tap(([criticalApps]) => {
          this.logService.debug(
            `[RiskInsightsOrchestratorService] Detected ${criticalApps.length} legacy critical apps, running migration and cleanup`,
            criticalApps,
          );
        }),
        switchMap(([criticalApps, _reportState]) =>
          this._runMigrationAndCleanup$(criticalApps).pipe(
            catchError((error: unknown) => {
              this.logService.error(
                "[RiskInsightsOrchestratorService] Migration and cleanup failed.",
                error,
              );
              return of([]);
            }),
          ),
        ),
        take(1),
      )
      .subscribe();
  }

  /**
   * Sets up the report state management pipeline
   * Combines report fetching, generation, and updates into a single state stream
   */
  private _setupReportState() {
    // Dependencies needed for report state
    const reportDependencies$ = combineLatest([
      this.organizationDetails$.pipe(filter((org) => !!org)),
      this._userId$.pipe(filter((user) => !!user)),
    ]).pipe(shareReplay({ bufferSize: 1, refCount: true }));

    // A stream that continuously watches dependencies and fetches a new report every time they change
    const continuousReportFetch$: Observable<ReportState> = reportDependencies$.pipe(
      switchMap(([orgDetails, userId]) =>
        this._fetchReport$(orgDetails!.organizationId, userId!).pipe(
          startWith<ReportState>({ status: ReportStatus.Initializing, error: null, data: null }),
        ),
      ),
    );

    // A stream for generating a new report
    const newReportGeneration$: Observable<ReportState> = this.generatingReport$.pipe(
      distinctUntilChanged(),
      filter((isRunning) => isRunning),
      withLatestFrom(reportDependencies$),
      exhaustMap(([_, [orgDetails, userId]]) =>
        this._generateNewApplicationsReportV2$(orgDetails!.organizationId, userId!),
      ),
      startWith<ReportState>({
        status: ReportStatus.Loading,
        error: null,
        data: null,
      }),
      tap(() => {
        this._generateReportTriggerSubject.next(false);
      }),
    );

    // Combine all triggers and update the single report state
    const mergedReportState$ = merge(
      continuousReportFetch$,
      newReportGeneration$,
      this._flagForUpdates$,
    ).pipe(
      startWith<ReportState>({
        status: ReportStatus.Initializing,
        error: null,
        data: null,
      }),
      withLatestFrom(this.organizationDetails$),
      map(([reportState, orgDetails]) => {
        return {
          reportState,
          organizationId: orgDetails?.organizationId,
        };
      }),

      // 3. NOW, scan receives a simple object for both prevState and currState
      scan((prevState, currState) => {
        const hasOrganizationChanged = prevState.organizationId !== currState.organizationId;
        // Don't override initial status until complete
        const keepInitializeStatus =
          prevState.reportState.status == ReportStatus.Initializing &&
          currState.reportState.status == ReportStatus.Loading;
        return {
          reportState: {
            status: keepInitializeStatus
              ? prevState.reportState.status
              : (currState.reportState.status ?? prevState.reportState.status),
            error: currState.reportState.error ?? prevState.reportState.error,
            data:
              currState.reportState.data !== null || hasOrganizationChanged
                ? currState.reportState.data
                : prevState.reportState.data,
          },
          organizationId: currState.organizationId,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      takeUntil(this._destroy$),
    );

    this._reportStateSubscription = mergedReportState$
      .pipe(takeUntil(this._destroy$))
      .subscribe((state) => {
        // Update the raw report data subject
        this._rawReportDataSubject.next(state.reportState);

        // Update the critical application at risk cipher ids for exposure
        const reportState = state.reportState?.data;
        if (reportState) {
          const criticalApplicationAtRiskCipherIds = this._getCriticalApplicationCipherIds(
            reportState.reportData || [],
            reportState.applicationData || [],
          );
          this._criticalApplicationAtRiskCipherIdsSubject$.next(criticalApplicationAtRiskCipherIds);
        }
      });
  }

  /**
   * Validates the consistency of saved report data to catch potential issues
   *
   * @param reportState The report state to validate
   * @param operation The save operation type for logging context
   */
  private _validateSaveConsistency(
    reportState: ReportState,
    operation: "critical" | "remove" | "review",
  ): void {
    if (!reportState.data) {
      return;
    }

    const { reportData, applicationData, summaryData } = reportState.data;

    // Check for orphaned applications (in applicationData but not in reportData)
    const reportAppNames = new Set(reportData.map((r) => r.applicationName));
    const orphanedApps = applicationData.filter((app) => !reportAppNames.has(app.applicationName));

    if (orphanedApps.length > 0) {
      this.logService.warning(
        `[RiskInsightsOrchestratorService] Found ${orphanedApps.length} orphaned applications after ${operation} operation`,
        orphanedApps.map((a) => a.applicationName),
      );
    }

    // Validate summary totals match computed values
    const computedSummary = this.reportService.getApplicationsSummary(
      reportData,
      applicationData,
      summaryData.totalMemberCount,
    );

    // Check critical app count consistency
    if (
      summaryData.totalCriticalApplicationCount !== computedSummary.totalCriticalApplicationCount
    ) {
      this.logService.error(
        `[RiskInsightsOrchestratorService] Critical app count mismatch after ${operation}: ` +
          `stored=${summaryData.totalCriticalApplicationCount}, computed=${computedSummary.totalCriticalApplicationCount}`,
      );
    }

    // Check at-risk member count consistency
    if (summaryData.totalAtRiskMemberCount !== computedSummary.totalAtRiskMemberCount) {
      this.logService.error(
        `[RiskInsightsOrchestratorService] At-risk member count mismatch after ${operation}: ` +
          `stored=${summaryData.totalAtRiskMemberCount}, computed=${computedSummary.totalAtRiskMemberCount}`,
      );
    }
  }

  /**
   * Gets the unique cipher IDs that are marked at risk in critical applications
   */
  private _getCriticalApplicationCipherIds(
    applications: ApplicationHealthReportDetail[],
    applicationData: OrganizationReportApplication[],
  ): CipherId[] {
    const foundCipherIds = applications
      .map((app) => {
        const isCriticalApplication = this.reportService.isCriticalApplication(
          app,
          applicationData,
        );
        return isCriticalApplication ? app.atRiskCipherIds : [];
      })
      .flat();

    // Use a set to ensure uniqueness
    const uniqueCipherIds = new Set<CipherId>([...foundCipherIds]);

    return [...uniqueCipherIds];
  }

  /**
   * Sets up the user ID observable to track the current active user
   */
  private _setupUserId() {
    // Watch userId changes
    this.accountService.activeAccount$
      .pipe(getUserId, takeUntil(this._destroy$))
      .subscribe((userId) => {
        this._userIdSubject.next(userId);
      });
  }

  // ==================== V2 METHODS - Frontend Member Mapping ====================
  // These methods implement the Access Intelligence pattern to avoid backend timeout issues.
  // V2 performs member-to-cipher mapping on the frontend using collection relationships,
  // eliminating the need for the problematic backend getMemberCipherDetails endpoint.

  /**
   * Fetches organization users and groups in a single optimized call (V2)
   *
   * @returns Observable containing group membership and user email maps
   */
  private _fetchOrganizationUsersAndGroupsV2$(organizationId: OrganizationId): Observable<{
    groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>;
    userEmailMap: Map<string, string>;
  }> {
    // Fetch users and groups in parallel
    return forkJoin({
      orgUsersResponse: from(
        this.organizationUserApiService.getAllUsers(organizationId, { includeGroups: true }),
      ),
      groupsResponse: this.reportApiService.getOrganizationGroups$(organizationId),
    }).pipe(
      map(({ orgUsersResponse, groupsResponse }) => {
        // Build group name lookup
        const groupNameMap = new Map<string, string>();
        for (const group of groupsResponse) {
          groupNameMap.set(group.id, group.name);
        }

        // Build both maps from the same response
        const groupMemberMap = new Map<string, { groupName: string; memberIds: string[] }>();
        const userEmailMap = new Map<string, string>();

        for (const orgUser of orgUsersResponse.data) {
          // Build email map
          if (orgUser.id && orgUser.email) {
            userEmailMap.set(orgUser.id, orgUser.email);
          }

          // Build group member map
          if (orgUser.groups && orgUser.groups.length > 0) {
            for (const groupId of orgUser.groups) {
              let groupData = groupMemberMap.get(groupId);
              if (!groupData) {
                const groupName = groupNameMap.get(groupId) ?? "";
                groupData = { groupName, memberIds: [] };
                groupMemberMap.set(groupId, groupData);
              }
              groupData.memberIds.push(orgUser.id);
            }
          }
        }

        return { groupMemberMap, userEmailMap };
      }),
    );
  }

  /**
   * Loads organization data (collections, users, groups) for V2 member mapping
   *
   * @returns Observable containing collection map, group member map, and user email map
   */
  private _loadOrganizationDataV2$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<OrganizationDataV2> {
    // Fetch collections and users in parallel
    const collections$ = this.collectionAdminService
      .collectionAdminViews$(organizationId, currentUserId)
      .pipe(take(1));

    const usersAndGroups$ = this._fetchOrganizationUsersAndGroupsV2$(organizationId);

    return forkJoin([collections$, usersAndGroups$]).pipe(
      map(([collections, { groupMemberMap, userEmailMap }]) => {
        const collectionMap = new Map<string, CollectionAdminView>();
        collections.forEach((c) => collectionMap.set(c.id, c));

        return { collectionMap, groupMemberMap, userEmailMap };
      }),
    );
  }

  /**
   * Gets all members with access to a cipher using V2 collection-based mapping
   *
   * @returns Array of member access information including permissions and access type
   */
  private _getCipherMembersV2(
    cipher: CipherView,
    orgData: OrganizationDataV2,
  ): CipherMemberAccessInfoV2[] {
    const memberMap = new Map<string, CipherMemberAccessInfoV2>();

    if (!cipher.collectionIds || cipher.collectionIds.length === 0) {
      return [];
    }

    for (const collectionId of cipher.collectionIds) {
      const collection = orgData.collectionMap.get(collectionId);
      if (!collection) {
        continue;
      }

      // Process direct user assignments
      for (const userAccess of collection.users) {
        const userId = userAccess.id;
        const existing = memberMap.get(userId);

        if (!existing) {
          memberMap.set(userId, {
            userId,
            email: orgData.userEmailMap.get(userId) ?? null,
            accessType: "direct",
            collectionId: collection.id,
            collectionName: collection.name || "Unknown",
            canEdit: !userAccess.readOnly,
            canViewPasswords: !userAccess.hidePasswords,
            canManage: userAccess.manage,
          });
        } else {
          // Update to most permissive
          if (!userAccess.readOnly) {
            existing.canEdit = true;
          }
          if (!userAccess.hidePasswords) {
            existing.canViewPasswords = true;
          }
          if (userAccess.manage) {
            existing.canManage = true;
          }
        }
      }

      // Process group assignments
      for (const groupAccess of collection.groups) {
        const groupId = groupAccess.id;
        const groupData = orgData.groupMemberMap.get(groupId);

        if (!groupData || groupData.memberIds.length === 0) {
          continue;
        }

        for (const userId of groupData.memberIds) {
          const existing = memberMap.get(userId);

          if (!existing) {
            memberMap.set(userId, {
              userId,
              email: orgData.userEmailMap.get(userId) ?? null,
              accessType: "group",
              collectionId: collection.id,
              collectionName: collection.name || "Unknown",
              groupId,
              groupName: groupData.groupName,
              canEdit: !groupAccess.readOnly,
              canViewPasswords: !groupAccess.hidePasswords,
              canManage: groupAccess.manage,
            });
          } else {
            // Update to most permissive
            if (!groupAccess.readOnly) {
              existing.canEdit = true;
            }
            if (!groupAccess.hidePasswords) {
              existing.canViewPasswords = true;
            }
            if (groupAccess.manage) {
              existing.canManage = true;
            }
          }
        }
      }
    }

    return Array.from(memberMap.values());
  }

  /**
   * Map ciphers to members using frontend collection mapping (V2)
   */
  private _mapCiphersToMembersV2(
    ciphers: CipherView[],
    orgData: OrganizationDataV2,
  ): Map<string, CipherMemberAccessInfoV2[]> {
    const memberMap = new Map<string, CipherMemberAccessInfoV2[]>();

    for (const cipher of ciphers) {
      const members = this._getCipherMembersV2(cipher, orgData);
      memberMap.set(cipher.id, members);
    }

    return memberMap;
  }

  /**
   * Convert CipherMemberAccessInfoV2 to MemberDetails format
   */
  private _convertToMemberDetails(
    cipherId: string,
    members: CipherMemberAccessInfoV2[],
  ): MemberDetails[] {
    return members.map(
      (member): MemberDetails => ({
        cipherId,
        userGuid: member.userId,
        email: member.email ?? "",
        userName: null, // Not available in V2, set to null for now
      }),
    );
  }

  /**
   * Generate a new report using V2 approach (frontend member mapping)
   * This avoids the backend timeout issue with getMemberCipherDetails
   */
  private _generateNewApplicationsReportV2$(
    organizationId: OrganizationId,
    userId: UserId,
  ): Observable<ReportState> {
    // Reset progress and performance tracking
    this._reportProgressSubject.next(null);

    this.logService.debug(
      "[RiskInsightsOrchestratorService V2] Starting report generation with frontend mapping",
    );

    // Load organization data (users, groups, collections) in parallel with ciphers
    this._reportProgressSubject.next(ReportProgress.FetchingMembers);

    const orgData$ = this._loadOrganizationDataV2$(organizationId, userId).pipe(
      tap(() => {
        this.logService.debug("[RiskInsightsOrchestratorService V2] Organization data loaded");
      }),
      catchError((error: unknown) => {
        this.logService.error(
          "[RiskInsightsOrchestratorService V2] Failed to load organization data",
          error,
        );
        return throwError(
          () => new Error("Failed to load organization data (users/groups/collections)"),
        );
      }),
    );

    // Get ciphers and map to members on frontend
    const memberDetails$ = forkJoin([this._ciphers$.pipe(take(1)), orgData$]).pipe(
      tap(([ciphers, orgData]) => {
        this.logService.debug(
          `[RiskInsightsOrchestratorService V2] Data fetch complete - Ciphers: ${ciphers?.length ?? 0}, Collections: ${orgData.collectionMap.size}, Users: ${orgData.userEmailMap.size}`,
        );
      }),
      map(([ciphers, orgData]) => {
        // Map ciphers to members using collection relationships
        const memberMap = this._mapCiphersToMembersV2(ciphers ?? [], orgData);

        // Convert to MemberDetails format (flatten)
        const allMemberDetails: MemberDetails[] = [];
        for (const [cipherId, members] of memberMap.entries()) {
          const memberDetails = this._convertToMemberDetails(cipherId, members);
          allMemberDetails.push(...memberDetails);
        }

        return { ciphers: ciphers ?? [], memberDetails: allMemberDetails };
      }),
    );

    // Continue with existing password health pipeline
    const reportGeneration$ = memberDetails$.pipe(
      switchMap(({ ciphers, memberDetails }) => {
        this.logService.debug("[RiskInsightsOrchestratorService V2] Analyzing password health");
        this._reportProgressSubject.next(ReportProgress.AnalyzingPasswords);
        return forkJoin({
          memberDetails: of(memberDetails),
          cipherHealthReports: this._getCipherHealth(ciphers, memberDetails),
        }).pipe(
          tap(({ cipherHealthReports }) => {
            this.logService.debug(
              `[RiskInsightsOrchestratorService V2] Password analysis complete - Health reports: ${cipherHealthReports.length}`,
            );
          }),
          map(({ memberDetails, cipherHealthReports }) => {
            const uniqueMembers = getUniqueMembers(memberDetails);
            const totalMemberCount = uniqueMembers.length;

            return { cipherHealthReports, totalMemberCount };
          }),
        );
      }),
      map(({ cipherHealthReports, totalMemberCount }) => {
        this.logService.debug("[RiskInsightsOrchestratorService V2] Calculating risk scores");
        this._reportProgressSubject.next(ReportProgress.CalculatingRisks);
        const report = this.reportService.generateApplicationsReport(cipherHealthReports);
        return { report, totalMemberCount };
      }),
      tap(() => {
        this.logService.debug("[RiskInsightsOrchestratorService V2] Generating report data");
        this._reportProgressSubject.next(ReportProgress.GeneratingReport);
      }),
      withLatestFrom(this.rawReportData$),
      map(([{ report, totalMemberCount }, previousReport]) => {
        // Update the application data
        const updatedApplicationData = this.reportService.getOrganizationApplications(
          report,
          previousReport?.data?.applicationData ?? [],
        );

        const manualEnrichedApplications = report.map(
          (application): ApplicationHealthReportDetailEnriched => ({
            ...application,
            isMarkedAsCritical: this.reportService.isCriticalApplication(
              application,
              updatedApplicationData,
            ),
          }),
        );

        const updatedSummary = this.reportService.getApplicationsSummary(
          report,
          updatedApplicationData,
          totalMemberCount,
        );

        const metrics = this.reportService.getReportMetrics(
          manualEnrichedApplications,
          updatedSummary,
        );

        return {
          report,
          summary: updatedSummary,
          applications: updatedApplicationData,
          metrics,
        };
      }),
      switchMap(({ report, summary, applications, metrics }) => {
        this.logService.debug(
          "[RiskInsightsOrchestratorService V2] Encrypting and compressing report data",
        );
        this._reportProgressSubject.next(ReportProgress.EncryptingData);
        return this.reportService
          .saveRiskInsightsReport$(report, summary, applications, metrics, {
            organizationId,
            userId,
          })
          .pipe(
            tap(() => {
              this.logService.debug("[RiskInsightsOrchestratorService V2] Uploading report");
              this._reportProgressSubject.next(ReportProgress.Saving);
            }),
            map((result) => ({
              report,
              summary,
              applications,
              id: result.response.id,
              contentEncryptionKey: result.contentEncryptionKey,
            })),
          );
      }),
      // Update the running state
      tap(() => {
        this.logService.debug("[RiskInsightsOrchestratorService V2] Report generation complete");
        this._reportProgressSubject.next(ReportProgress.Complete);
      }),
      map((mappedResult): ReportState => {
        const { id, report, summary, applications, contentEncryptionKey } = mappedResult;
        return {
          status: ReportStatus.Complete,
          error: null,
          data: {
            id,
            reportData: report,
            summaryData: summary,
            applicationData: applications,
            creationDate: new Date(),
            contentEncryptionKey,
          },
        };
      }),
      catchError((error: unknown): Observable<ReportState> => {
        this.logService.error(
          "[RiskInsightsOrchestratorService V2] Report generation failed",
          error,
        );

        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate or save report (V2)";

        return of({
          status: ReportStatus.Error,
          error: errorMessage,
          data: null,
        });
      }),
      startWith<ReportState>({
        status: ReportStatus.Loading,
        error: null,
        data: null,
      }),
    ) as Observable<ReportState>;

    return reportGeneration$;
  }
}
