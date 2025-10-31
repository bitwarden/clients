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
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

import {
  buildPasswordUseMap,
  createNewSummaryData,
  flattenMemberDetails,
  getTrimmedCipherUris,
} from "../../helpers";
import {
  ApplicationHealthReportDetailEnriched,
  PasswordHealthReportApplicationsResponse,
} from "../../models";
import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import { RiskInsightsEnrichedData } from "../../models/report-data-service.types";
import {
  CipherHealthReport,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
  ReportStatus,
  ReportState,
} from "../../models/report-models";
import { MemberCipherDetailsApiService } from "../api/member-cipher-details-api.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { CriticalAppsService } from "./critical-apps.service";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

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
  newApplications$: Observable<string[]> = this.rawReportData$.pipe(
    map((reportState) => {
      if (!reportState.data?.applicationData) {
        return [];
      }
      return reportState.data.applicationData
        .filter((app) => app.reviewedDate === null)
        .map((app) => app.applicationName);
    }),
    distinctUntilChanged(
      (prev, curr) => prev.length === curr.length && prev.every((app, i) => app === curr[i]),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Generate report trigger and state
  private _generateReportTriggerSubject = new BehaviorSubject<boolean>(false);
  generatingReport$ = this._generateReportTriggerSubject.asObservable();

  // --------------------------- Critical Application data ---------------------
  criticalReportResults$: Observable<RiskInsightsEnrichedData | null> = of(null);

  // --------------------------- Trigger subjects ---------------------
  private _initializeOrganizationTriggerSubject = new Subject<OrganizationId>();
  private _fetchReportTriggerSubject = new Subject<void>();
  private _markUnmarkUpdatesSubject = new Subject<ReportState>();
  private _markUnmarkUpdates$ = this._markUnmarkUpdatesSubject.asObservable();

  private _reportStateSubscription: Subscription | null = null;
  private _migrationSubscription: Subscription | null = null;

  constructor(
    private accountService: AccountService,
    private cipherService: CipherService,
    private criticalAppsService: CriticalAppsService,
    private logService: LogService,
    private memberCipherDetailsApiService: MemberCipherDetailsApiService,
    private organizationService: OrganizationService,
    private passwordHealthService: PasswordHealthService,
    private reportApiService: RiskInsightsApiService,
    private reportService: RiskInsightsReportService,
    private riskInsightsEncryptionService: RiskInsightsEncryptionService,
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
   * Fetches the latest report for the current organization and user
   */
  fetchReport(): void {
    this.logService.debug("[RiskInsightsOrchestratorService] Fetch report triggered");
    this._fetchReportTriggerSubject.next();
  }

  /**
   * Generates a new report for the current organization and user
   */
  generateReport(): void {
    this.logService.debug("[RiskInsightsOrchestratorService] Create new report triggered");
    this._generateReportTriggerSubject.next(true);
  }

  /**
   * Initializes the service context for a specific organization
   *
   * @param organizationId The ID of the organization to initialize context for
   */
  initializeForOrganization(organizationId: OrganizationId) {
    this.logService.debug("[RiskInsightsOrchestratorService] Initializing for org", organizationId);
    this._initializeOrganizationTriggerSubject.next(organizationId);
    this.fetchReport();
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
          throwError(() => Error("Tried to update critical applications without a report"));
        }

        // Create a set for quick lookup of the new critical apps
        const existingApplicationData = report!.applicationData || [];
        const updatedApplicationData = this._removeCriticalApplication(
          existingApplicationData,
          criticalApplication,
        );

        // Updated summary data after changing critical apps
        const updatedSummaryData = this.reportService.getApplicationsSummary(
          report!.reportData,
          updatedApplicationData,
        );

        // Used for creating metrics with updated application data
        const manualEnrichedApplications = report!.reportData.map(
          (application): ApplicationHealthReportDetailEnriched => ({
            ...application,
            isMarkedAsCritical: this.reportService.isCriticalApplication(
              application,
              updatedApplicationData,
            ),
          }),
        );

        // For now, merge the report with the critical marking flag to make the enriched type
        // We don't care about the individual ciphers in this instance
        // After the report and enriched report types are consolidated, this mapping can be removed
        // and the class will expose getCriticalApplications
        const metrics = this._getReportMetrics(manualEnrichedApplications, updatedSummaryData);

        const updatedState = {
          ...reportState,
          data: {
            ...reportState.data,
            summaryData: updatedSummaryData,
            applicationData: updatedApplicationData,
          },
        } as ReportState;

        return { reportState, organizationDetails, updatedState, userId, metrics };
      }),
      switchMap(({ reportState, organizationDetails, updatedState, userId, metrics }) => {
        return from(
          this.riskInsightsEncryptionService.encryptRiskInsightsReport(
            {
              organizationId: organizationDetails!.organizationId,
              userId: userId!,
            },
            {
              reportData: reportState?.data?.reportData ?? [],
              summaryData: reportState?.data?.summaryData ?? createNewSummaryData(),
              applicationData: updatedState?.data?.applicationData ?? [],
            },
            reportState?.data?.contentEncryptionKey,
          ),
        ).pipe(
          map((encryptedData) => ({
            reportState,
            organizationDetails,
            updatedState,
            encryptedData,
            metrics,
          })),
        );
      }),
      switchMap(({ reportState, organizationDetails, updatedState, encryptedData, metrics }) => {
        this.logService.debug(
          `[RiskInsightsOrchestratorService] Saving applicationData with toggled critical flag for report with id: ${reportState?.data?.id} and org id: ${organizationDetails?.organizationId}`,
        );
        if (!reportState?.data?.id || !organizationDetails?.organizationId) {
          return of({ ...reportState });
        }

        // Update applications data with critical marking
        const updateApplicationsCall = this.reportApiService.updateRiskInsightsApplicationData$(
          reportState.data.id,
          organizationDetails.organizationId,
          {
            data: {
              applicationData: encryptedData.encryptedApplicationData.toSdk(),
            },
          },
        );
        // Update summary after recomputing
        const updateSummaryCall = this.reportApiService.updateRiskInsightsSummary$(
          reportState.data.id,
          organizationDetails.organizationId,
          {
            data: {
              summaryData: encryptedData.encryptedSummaryData.toSdk(),
              metrics: metrics.toRiskInsightsMetricsData(),
            },
          },
        );

        return forkJoin([updateApplicationsCall, updateSummaryCall]).pipe(
          map(() => updatedState),
          tap((finalState) => {
            this._markUnmarkUpdatesSubject.next({
              ...finalState,
              organizationId: reportState.organizationId,
            });
          }),
          catchError((error: unknown) => {
            this.logService.error("Failed to save remove critical application", error);
            return of({ ...reportState, error: "Failed to remove a critical application" });
          }),
        );
      }),
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
          throwError(() => Error("Tried to update critical applications without a report"));
        }

        // Create a set for quick lookup of the new critical apps
        const newCriticalAppNamesSet = new Set(criticalApplications);
        const existingApplicationData = report!.applicationData || [];
        const updatedApplicationData = this._mergeApplicationData(
          existingApplicationData,
          newCriticalAppNamesSet,
        );

        // Updated summary data after changing critical apps
        const updatedSummaryData = this.reportService.getApplicationsSummary(
          report!.reportData,
          updatedApplicationData,
        );

        // Used for creating metrics with updated application data
        const manualEnrichedApplications = report!.reportData.map(
          (application): ApplicationHealthReportDetailEnriched => ({
            ...application,
            isMarkedAsCritical: this.reportService.isCriticalApplication(
              application,
              updatedApplicationData,
            ),
          }),
        );

        // For now, merge the report with the critical marking flag to make the enriched type
        // We don't care about the individual ciphers in this instance
        // After the report and enriched report types are consolidated, this mapping can be removed
        // and the class will expose getCriticalApplications
        const metrics = this._getReportMetrics(manualEnrichedApplications, updatedSummaryData);

        const updatedState = {
          ...reportState,
          data: {
            ...reportState.data,
            summaryData: updatedSummaryData,
            applicationData: updatedApplicationData,
          },
        } as ReportState;

        return { reportState, organizationDetails, updatedState, userId, metrics };
      }),
      switchMap(({ reportState, organizationDetails, updatedState, userId, metrics }) => {
        return from(
          this.riskInsightsEncryptionService.encryptRiskInsightsReport(
            {
              organizationId: organizationDetails!.organizationId,
              userId: userId!,
            },
            {
              reportData: reportState?.data?.reportData ?? [],
              summaryData: reportState?.data?.summaryData ?? createNewSummaryData(),
              applicationData: updatedState?.data?.applicationData ?? [],
            },
            reportState?.data?.contentEncryptionKey,
          ),
        ).pipe(
          map((encryptedData) => ({
            reportState,
            organizationDetails,
            updatedState,
            encryptedData,
            metrics,
          })),
        );
      }),
      switchMap(({ reportState, organizationDetails, updatedState, encryptedData, metrics }) => {
        this.logService.debug(
          `[RiskInsightsOrchestratorService] Saving critical applications on applicationData with report id: ${reportState?.data?.id} and org id: ${organizationDetails?.organizationId}`,
        );
        if (!reportState?.data?.id || !organizationDetails?.organizationId) {
          return of({ ...reportState });
        }
        // Update applications data with critical marking
        const updateApplicationsCall = this.reportApiService.updateRiskInsightsApplicationData$(
          reportState.data.id,
          organizationDetails.organizationId,
          {
            data: {
              applicationData: encryptedData.encryptedApplicationData.toSdk(),
            },
          },
        );

        // Update summary after recomputing
        const updateSummaryCall = this.reportApiService.updateRiskInsightsSummary$(
          reportState.data.id,
          organizationDetails.organizationId,
          {
            data: {
              summaryData: encryptedData.encryptedSummaryData.toSdk(),
              metrics: metrics.toRiskInsightsMetricsData(),
            },
          },
        );
        return forkJoin([updateApplicationsCall, updateSummaryCall]).pipe(
          map(() => updatedState),
          tap((finalState) => {
            this._markUnmarkUpdatesSubject.next({
              ...finalState,
              organizationId: reportState.organizationId,
            });
          }),
          catchError((error: unknown) => {
            this.logService.error("Failed to save critical applications", error);
            return of({ ...reportState, error: "Failed to save critical applications" });
          }),
        );
      }),
    );
  }

  /**
   * Saves review status for new applications and optionally marks selected ones as critical.
   * This method:
   * 1. Sets reviewedDate to current date for all applications where reviewedDate === null
   * 2. Sets isCritical = true for applications in the selectedCriticalApps array
   *
   * @param selectedCriticalApps Array of application names to mark as critical (can be empty)
   * @returns Observable of updated ReportState
   */
  saveApplicationReviewStatus$(selectedCriticalApps: string[]): Observable<ReportState> {
    this.logService.info("[RiskInsightsOrchestratorService] Saving application review status", {
      criticalAppsCount: selectedCriticalApps.length,
    });

    return this.rawReportData$.pipe(
      take(1),
      filter((data) => data.status != ReportStatus.Loading && data.data != null),
      withLatestFrom(
        this.organizationDetails$.pipe(filter((org) => !!org && !!org.organizationId)),
        this._userId$.pipe(filter((userId) => !!userId)),
      ),
      map(([reportState, organizationDetails, userId]) => {
        const existingApplicationData = reportState?.data?.applicationData || [];
        const updatedApplicationData = this._updateReviewStatusAndCriticalFlags(
          existingApplicationData,
          selectedCriticalApps,
        );

        const updatedState = {
          ...reportState,
          data: {
            ...reportState.data,
            applicationData: updatedApplicationData,
          },
        } as ReportState;

        this.logService.debug("[RiskInsightsOrchestratorService] Updated review status", {
          totalApps: updatedApplicationData.length,
          reviewedApps: updatedApplicationData.filter((app) => app.reviewedDate !== null).length,
          criticalApps: updatedApplicationData.filter((app) => app.isCritical).length,
        });

        return { reportState, organizationDetails, updatedState, userId };
      }),
      switchMap(({ reportState, organizationDetails, updatedState, userId }) => {
        return from(
          this.riskInsightsEncryptionService.encryptRiskInsightsReport(
            {
              organizationId: organizationDetails!.organizationId,
              userId: userId!,
            },
            {
              reportData: reportState?.data?.reportData ?? [],
              summaryData: reportState?.data?.summaryData ?? createNewSummaryData(),
              applicationData: updatedState?.data?.applicationData ?? [],
            },
            reportState?.data?.contentEncryptionKey,
          ),
        ).pipe(
          map((encryptedData) => ({
            reportState,
            organizationDetails,
            updatedState,
            encryptedData,
          })),
        );
      }),
      switchMap(({ reportState, organizationDetails, updatedState, encryptedData }) => {
        this.logService.debug(
          `[RiskInsightsOrchestratorService] Persisting review status - report id: ${reportState?.data?.id}`,
        );

        if (!reportState?.data?.id || !organizationDetails?.organizationId) {
          this.logService.warning(
            "[RiskInsightsOrchestratorService] Cannot save review status - missing report id or org id",
          );
          return of({ ...reportState });
        }

        return this.reportApiService
          .updateRiskInsightsApplicationData$(
            reportState.data.id,
            organizationDetails.organizationId,
            {
              data: {
                applicationData: encryptedData.encryptedApplicationData.toSdk(),
              },
            },
          )
          .pipe(
            map(() => updatedState),
            tap((finalState) => {
              this._markUnmarkUpdatesSubject.next(finalState);
            }),
            catchError((error: unknown) => {
              this.logService.error(
                "[RiskInsightsOrchestratorService] Failed to save review status",
                error,
              );
              return of({ ...reportState, error: "Failed to save application review status" });
            }),
          );
      }),
    );
  }

  private _fetchReport$(
    organizationId: OrganizationId,
    userId: UserId,
  ): Observable<ReportState | null> {
    return this.reportService.getRiskInsightsReport$(organizationId, userId).pipe(
      tap(() => this.logService.debug("[RiskInsightsOrchestratorService] Fetching report")),
      map((result): ReportState => {
        return {
          status: ReportStatus.Complete,
          error: null,
          data: result,
          organizationId,
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

  private _generateNewApplicationsReport$(
    organizationId: OrganizationId,
    userId: UserId,
  ): Observable<ReportState> {
    // Generate the report
    const memberCiphers$ = from(
      this.memberCipherDetailsApiService.getMemberCipherDetails(organizationId),
    ).pipe(map((memberCiphers) => flattenMemberDetails(memberCiphers)));

    return forkJoin([this._ciphers$.pipe(take(1)), memberCiphers$]).pipe(
      tap(() => {
        this.logService.debug("[RiskInsightsOrchestratorService] Generating new report");
      }),
      switchMap(([ciphers, memberCiphers]) => this._getCipherHealth(ciphers ?? [], memberCiphers)),
      map((cipherHealthReports) =>
        this.reportService.generateApplicationsReport(cipherHealthReports),
      ),
      withLatestFrom(this.rawReportData$),
      map(([report, previousReport]) => {
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
        );
        // For now, merge the report with the critical marking flag to make the enriched type
        // We don't care about the individual ciphers in this instance
        // After the report and enriched report types are consolidated, this mapping can be removed
        // and the class will expose getCriticalApplications
        const metrics = this._getReportMetrics(manualEnrichedApplications, updatedSummary);

        return {
          report,
          summary: updatedSummary,
          applications: updatedApplicationData,
          metrics,
        };
      }),
      switchMap(({ report, summary, applications, metrics }) => {
        return this.reportService
          .saveRiskInsightsReport$(report, summary, applications, metrics, {
            organizationId,
            userId,
          })
          .pipe(
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
          organizationId,
        };
      }),
      catchError((): Observable<ReportState> => {
        return of({
          status: ReportStatus.Error,
          error: "Failed to generate or save report",
          data: null,
          organizationId,
        });
      }),
      // startWith<ReportState>({
      //   status: ReportStatus.Loading,
      //   error: null,
      //   data: null,
      //   organizationId,
      // }),
    );
  }

  // Calculates the metrics for a report
  // This function will be moved to the RiskInsightsReportService after the
  // ApplicationHealthReportDetail and ApplicationHealthReportDetailEnriched types
  // are consolidated into one
  _getReportMetrics(
    reports: ApplicationHealthReportDetailEnriched[],
    summary: OrganizationReportSummary,
  ): RiskInsightsMetrics {
    const metrics = new RiskInsightsMetrics();
    const s = summary;

    // Copy summary information
    metrics.totalApplicationCount = s.totalApplicationCount;
    metrics.totalAtRiskApplicationCount = s.totalAtRiskApplicationCount;
    metrics.totalCriticalApplicationCount = s.totalCriticalApplicationCount;
    metrics.totalCriticalAtRiskApplicationCount = s.totalCriticalAtRiskApplicationCount;
    metrics.totalMemberCount = s.totalMemberCount;
    metrics.totalAtRiskMemberCount = s.totalAtRiskMemberCount;
    metrics.totalCriticalMemberCount = s.totalCriticalMemberCount;
    metrics.totalCriticalAtRiskMemberCount = s.totalCriticalAtRiskMemberCount;

    // Calculate additional metrics
    let totalPasswordCount = 0;
    let totalAtRiskPasswordCount = 0;
    let totalCriticalPasswordCount = 0;
    let totalCriticalAtRiskPasswordCount = 0;

    reports.forEach((report) => {
      totalPasswordCount += report.cipherIds.length;
      totalAtRiskPasswordCount += report.atRiskCipherIds.length;

      if (report.isMarkedAsCritical) {
        totalCriticalPasswordCount += report.cipherIds.length;
        totalCriticalAtRiskPasswordCount += report.atRiskCipherIds.length;
      }
    });

    metrics.totalPasswordCount = totalPasswordCount;
    metrics.totalAtRiskPasswordCount = totalAtRiskPasswordCount;
    metrics.totalCriticalPasswordCount = totalCriticalPasswordCount;
    metrics.totalCriticalAtRiskPasswordCount = totalCriticalAtRiskPasswordCount;

    return metrics;
  }
  /**
   * Associates the members with the ciphers they have access to. Calculates the password health.
   * Finds the trimmed uris.
   * @param ciphers Org ciphers
   * @param memberDetails Org members
   * @returns Cipher password health data with trimmed uris and associated members
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
        return validCiphers.map((cipher) => {
          const exposedPasswordDetail = exposedDetails.find((x) => x?.cipherId === cipher.id);
          const cipherMembers = memberDetails.filter((x) => x.cipherId === cipher.id);
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

  // Updates the existing application data to include critical applications
  // Does not remove critical applications not in the set
  private _mergeApplicationData(
    existingApplications: OrganizationReportApplication[],
    criticalApplications: Set<string>,
  ): OrganizationReportApplication[] {
    const setToMerge = new Set(criticalApplications);

    const updatedApps = existingApplications.map((app) => {
      const foundCritical = setToMerge.has(app.applicationName);

      if (foundCritical) {
        setToMerge.delete(app.applicationName);
      }

      return {
        ...app,
        isCritical: foundCritical || app.isCritical,
      };
    });

    setToMerge.forEach((applicationName) => {
      updatedApps.push({
        applicationName,
        isCritical: true,
        reviewedDate: null,
      });
    });

    return updatedApps;
  }

  /**
   * Updates review status and critical flags for applications.
   * Sets reviewedDate for all apps with null reviewedDate.
   * Sets isCritical flag for apps in the criticalApplications array.
   *
   * @param existingApplications Current application data
   * @param criticalApplications Array of application names to mark as critical
   * @returns Updated application data with review dates and critical flags
   */
  private _updateReviewStatusAndCriticalFlags(
    existingApplications: OrganizationReportApplication[],
    criticalApplications: string[],
  ): OrganizationReportApplication[] {
    const criticalSet = new Set(criticalApplications);
    const currentDate = new Date();

    return existingApplications.map((app) => {
      const shouldMarkCritical = criticalSet.has(app.applicationName);
      const needsReviewDate = app.reviewedDate === null;

      // Only create new object if changes are needed
      if (needsReviewDate || shouldMarkCritical) {
        return {
          ...app,
          reviewedDate: needsReviewDate ? currentDate : app.reviewedDate,
          isCritical: shouldMarkCritical || app.isCritical,
        };
      }

      return app;
    });
  }

  // Toggles the isCritical flag on applications via criticalApplicationName
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

  // Setup the pipeline to load critical applications when organization or user changes
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

  // Setup the pipeline to create a report view filtered to only critical applications
  private _setupCriticalApplicationReport() {
    const criticalReportResultsPipeline$ = this.enrichedReportData$.pipe(
      filter((state) => !!state),
      map((enrichedReports) => {
        const criticalApplications = enrichedReports!.reportData.filter(
          (app) => app.isMarkedAsCritical,
        );
        // Generate a new summary based on just the critical applications
        const summary = this.reportService.getApplicationsSummary(
          criticalApplications,
          enrichedReports.applicationData,
        );
        return {
          ...enrichedReports,
          summaryData: summary,
          reportData: criticalApplications,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.criticalReportResults$ = criticalReportResultsPipeline$;
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

  // Setup the pipeline to initialize organization context
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
          );
          this._ciphersSubject.next(ciphers);
          this._hasCiphersSubject$.next(ciphers.length > 0);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe((orgDetails) => this._organizationDetailsSubject.next(orgDetails));
  }

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

  // Setup the report state management pipeline
  private _setupReportState() {
    // Dependencies needed for report state
    const reportDependencies$ = combineLatest([
      this.organizationDetails$.pipe(filter((org) => !!org)),
      this._userId$.pipe(filter((user) => !!user)),
    ]).pipe(shareReplay({ bufferSize: 1, refCount: true }));

    // A stream for the initial report fetch
    const initialReportLoad$ = reportDependencies$.pipe(
      take(1),
      exhaustMap(([orgDetails, userId]) => this._fetchReport$(orgDetails!.organizationId, userId!)),
      startWith({ status: ReportStatus.Initializing, error: null, data: null }),
    );

    // A stream for manually triggered fetches
    const manualReportFetch$ = this._fetchReportTriggerSubject.pipe(
      withLatestFrom(reportDependencies$),
      exhaustMap(([_, [orgDetails, userId]]) =>
        this._fetchReport$(orgDetails!.organizationId, userId!),
      ),
      // startWith({ status: ReportStatus.Loading, error: null, data: null }),
    );

    // A stream for generating a new report
    const newReportGeneration$ = this.generatingReport$.pipe(
      distinctUntilChanged(),
      filter((isRunning) => isRunning),
      withLatestFrom(reportDependencies$),
      exhaustMap(([_, [orgDetails, userId]]) =>
        this._generateNewApplicationsReport$(orgDetails!.organizationId, userId!),
      ),
      tap(() => {
        this._generateReportTriggerSubject.next(false);
      }),
      // startWith({ status: ReportStatus.Loading, error: null, data: null }),
    );

    // Combine all triggers and update the single report state
    const mergedReportState$ = merge(
      initialReportLoad$,
      manualReportFetch$,
      newReportGeneration$,
      this._markUnmarkUpdates$,
    ).pipe(
      scan((prevState: ReportState, currState: ReportState) => {
        // If organization changed, use new state completely (don't preserve old data)
        // This allows null data to clear old org's data when switching orgs
        if (currState.organizationId && prevState.organizationId !== currState.organizationId) {
          return {
            ...currState,
            data: currState.data, // Allow null to clear old org's data
          };
        }

        // Same org (or no org ID): preserve data when currState.data is null
        // This preserves critical flags during loading states within the same org
        return {
          ...prevState,
          ...currState,
          data: currState.data !== null ? currState.data : prevState.data,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      // startWith({ status: ReportStatus.Initializing, error: null, data: null }),
      takeUntil(this._destroy$),
    );

    this._reportStateSubscription = mergedReportState$
      .pipe(takeUntil(this._destroy$))
      .subscribe((state) => {
        this._rawReportDataSubject.next(state);
      });
  }

  // Setup the user ID observable to track the current user
  private _setupUserId() {
    // Watch userId changes
    this.accountService.activeAccount$
      .pipe(getUserId, takeUntil(this._destroy$))
      .subscribe((userId) => {
        this._userIdSubject.next(userId);
      });
  }
}
