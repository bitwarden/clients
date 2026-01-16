import { Injectable, signal, inject, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { from, Observable, of } from "rxjs";
import { catchError, switchMap, tap, last, map } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { getTrimmedCipherUris } from "../../helpers/risk-insights-data-mappers";

import {
  CipherAccessMappingService,
  CipherWithMemberAccess,
  MemberAccessLoadState,
} from "./cipher-access-mapping.service";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsPrototypeService } from "./risk-insights-prototype.service";
import {
  ProcessingPhase,
  ProgressInfo,
  RiskInsightsApplication,
  RiskInsightsItem,
  RiskInsightsItemStatus,
  calculateRiskStatus,
} from "./risk-insights-prototype.types";

/**
 * Orchestration service for the Risk Insights Prototype.
 *
 * Coordinates progressive loading in phases:
 * - Phase 1: Load ciphers and display immediately
 * - Phase 2: Run health checks (weak + reused) if enabled
 * - Phase 3: Load member counts progressively
 * - Phase 4: Run HIBP checks last (if enabled), updating items progressively
 *
 * Uses Angular Signals internally (per ADR-0027), exposed as read-only signals.
 */
@Injectable()
export class RiskInsightsPrototypeOrchestrationService {
  // ============================================================================
  // Injected Dependencies
  // ============================================================================
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly cipherAccessMappingService = inject(CipherAccessMappingService);
  private readonly passwordHealthService = inject(PasswordHealthService);
  private readonly riskInsightsService = inject(RiskInsightsPrototypeService);
  private readonly destroyRef = inject(DestroyRef);

  // ============================================================================
  // Private State
  // ============================================================================
  private organizationId: OrganizationId | null = null;
  private currentUserId: UserId | null = null;
  private cipherIndexMap = new Map<string, number>();
  private allCiphers: CipherView[] = [];
  private passwordUseMap: Map<string, string[]> = new Map();

  /** Maps cipher ID to the domains (applications) it belongs to */
  private cipherToApplicationsMap = new Map<string, string[]>();

  /** Maps domain to the cipher IDs that belong to it */
  private applicationToCiphersMap = new Map<string, string[]>();

  /** Maps cipher ID to the set of member IDs with access (for at-risk member tracking) */
  private cipherToMemberIdsMap = new Map<string, Set<string>>();

  // ============================================================================
  // Internal Signals (private, writable)
  // ============================================================================

  // Configuration flags (default all to false per requirements)
  private readonly _enableWeakPassword = signal(false);
  private readonly _enableHibp = signal(false);
  private readonly _enableReusedPassword = signal(false);

  // Processing state
  private readonly _processingPhase = signal<ProcessingPhase>(ProcessingPhase.Idle);
  private readonly _progressMessage = signal("");

  // Progress tracking
  private readonly _cipherProgress = signal<ProgressInfo>({ current: 0, total: 0, percent: 0 });
  private readonly _healthProgress = signal<ProgressInfo>({ current: 0, total: 0, percent: 0 });
  private readonly _memberProgress = signal<ProgressInfo>({ current: 0, total: 0, percent: 0 });
  private readonly _hibpProgress = signal<ProgressInfo>({ current: 0, total: 0, percent: 0 });

  // Results
  private readonly _items = signal<RiskInsightsItem[]>([]);
  private readonly _applications = signal<RiskInsightsApplication[]>([]);

  // Error state
  private readonly _error = signal<string | null>(null);

  // ============================================================================
  // Public Read-only Signals (for template binding)
  // ============================================================================

  // Configuration flags
  readonly enableWeakPassword = this._enableWeakPassword.asReadonly();
  readonly enableHibp = this._enableHibp.asReadonly();
  readonly enableReusedPassword = this._enableReusedPassword.asReadonly();

  // Processing state
  readonly processingPhase = this._processingPhase.asReadonly();
  readonly progressMessage = this._progressMessage.asReadonly();

  // Progress tracking
  readonly cipherProgress = this._cipherProgress.asReadonly();
  readonly healthProgress = this._healthProgress.asReadonly();
  readonly memberProgress = this._memberProgress.asReadonly();
  readonly hibpProgress = this._hibpProgress.asReadonly();

  // Results
  readonly items = this._items.asReadonly();
  readonly applications = this._applications.asReadonly();

  // Error state
  readonly error = this._error.asReadonly();

  // Expose constants for template access
  readonly ProcessingPhase = ProcessingPhase;

  // ============================================================================
  // Public Methods - Initialization
  // ============================================================================

  /**
   * Initialize the service for a specific organization.
   */
  initializeForOrganization(organizationId: OrganizationId): void {
    this.organizationId = organizationId;

    this.accountService.activeAccount$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((account) => {
        if (account) {
          this.currentUserId = account.id as UserId;
        }
      });
  }

  // ============================================================================
  // Public Methods - Configuration
  // ============================================================================

  toggleEnableWeakPassword(): void {
    this._enableWeakPassword.update((current) => !current);
  }

  toggleEnableHibp(): void {
    this._enableHibp.update((current) => !current);
  }

  toggleEnableReusedPassword(): void {
    this._enableReusedPassword.update((current) => !current);
  }

  setEnableWeakPassword(enabled: boolean): void {
    this._enableWeakPassword.set(enabled);
  }

  setEnableHibp(enabled: boolean): void {
    this._enableHibp.set(enabled);
  }

  setEnableReusedPassword(enabled: boolean): void {
    this._enableReusedPassword.set(enabled);
  }

  // ============================================================================
  // Public Methods - Actions
  // ============================================================================

  /**
   * Starts progressive loading:
   * Phase 1: Load ciphers, display immediately
   * Phase 2: Run health checks (weak + reused) if enabled
   * Phase 3: Load member counts progressively
   * Phase 4: Run HIBP checks last (if enabled)
   */
  startProcessing(): void {
    if (!this.organizationId || !this.currentUserId) {
      this._processingPhase.set(ProcessingPhase.Error);
      this._error.set("Organization ID or User ID not available");
      return;
    }

    this.resetState();
    this._processingPhase.set(ProcessingPhase.LoadingCiphers);
    this._progressMessage.set("Loading ciphers...");

    // PHASE 1: Load ciphers
    from(this.cipherService.getAllFromApiForOrganization(this.organizationId))
      .pipe(
        tap((ciphers) => {
          this.allCiphers = ciphers;

          // Transform to items and display immediately
          const items = this.riskInsightsService.transformCiphersToItems(ciphers);
          this._items.set(items);

          // Build cipher index map for O(1) updates
          this.cipherIndexMap.clear();
          items.forEach((item, index) => {
            this.cipherIndexMap.set(item.cipherId, index);
          });

          this._cipherProgress.set({
            current: items.length,
            total: items.length,
            percent: 100,
          });

          // Build password use map for reuse detection
          this.passwordUseMap = this.riskInsightsService.buildPasswordUseMap(ciphers);

          // Build application aggregations
          this.buildApplicationAggregations();
        }),
        // PHASE 2: Run health checks if enabled
        switchMap(() => this.runHealthChecksIfEnabled$()),
        // PHASE 3: Load member counts
        switchMap(() => this.runMemberCountsLoading$()),
        // PHASE 4: Run HIBP checks if enabled (runs last)
        tap(() => {
          if (this._enableHibp()) {
            this._processingPhase.set(ProcessingPhase.RunningHibp);
            this._progressMessage.set("Checking for exposed passwords...");
            this.runHibpChecks$()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                complete: () => {
                  this._processingPhase.set(ProcessingPhase.Complete);
                  this._progressMessage.set("");
                },
                error: (_err: unknown) => {
                  // HIBP check error - silently ignore for prototype
                },
              });
          } else {
            this._processingPhase.set(ProcessingPhase.Complete);
            this._progressMessage.set("");
            this.finalizeItemStatuses();
          }
        }),
        takeUntilDestroyed(this.destroyRef),
        catchError((err: unknown) => {
          this._processingPhase.set(ProcessingPhase.Error);
          const errorMessage = err instanceof Error ? err.message : "An error occurred";
          this._error.set(errorMessage);
          return of(undefined);
        }),
      )
      .subscribe();
  }

  /**
   * Reset all state to initial values.
   */
  resetState(): void {
    this._items.set([]);
    this._applications.set([]);
    this._processingPhase.set(ProcessingPhase.Idle);
    this._progressMessage.set("");
    this._cipherProgress.set({ current: 0, total: 0, percent: 0 });
    this._healthProgress.set({ current: 0, total: 0, percent: 0 });
    this._memberProgress.set({ current: 0, total: 0, percent: 0 });
    this._hibpProgress.set({ current: 0, total: 0, percent: 0 });
    this._error.set(null);
    this.cipherIndexMap.clear();
    this.allCiphers = [];
    this.passwordUseMap.clear();
    this.cipherToApplicationsMap.clear();
    this.applicationToCiphersMap.clear();
    this.cipherToMemberIdsMap.clear();
  }

  // ============================================================================
  // Private Methods - Health Checks
  // ============================================================================

  private runHealthChecksIfEnabled$(): Observable<void> {
    const enableWeak = this._enableWeakPassword();
    const enableReused = this._enableReusedPassword();

    if (!enableWeak && !enableReused) {
      // No health checks enabled, skip this phase
      return of(undefined);
    }

    this._processingPhase.set(ProcessingPhase.RunningHealthChecks);
    this._progressMessage.set("Analyzing password health...");

    const totalCiphers = this.allCiphers.length;
    let processedCount = 0;

    return this.riskInsightsService.checkWeakPasswordsBatched$(this.allCiphers, 100).pipe(
      tap((weakResults) => {
        // Update items with weak password results
        const currentItems = [...this._items()];
        const reusedCipherIds = this.riskInsightsService.findReusedPasswordCipherIds(
          currentItems.map((i) => i.cipherId),
          this.passwordUseMap,
          this.allCiphers,
        );

        for (const result of weakResults) {
          const index = this.cipherIndexMap.get(result.cipherId);
          if (index === undefined) {
            continue;
          }

          let item = currentItems[index];

          // Update weak password status if enabled
          if (enableWeak) {
            item = this.riskInsightsService.updateItemWithWeakPassword(
              item,
              result.weakPasswordDetail,
              enableWeak,
              enableReused,
              this._enableHibp(),
            );
          }

          // Update reused password status if enabled
          if (enableReused) {
            const isReused = reusedCipherIds.has(result.cipherId);
            item = this.riskInsightsService.updateItemWithReusedPassword(
              item,
              isReused,
              enableWeak,
              enableReused,
              this._enableHibp(),
            );
          }

          currentItems[index] = item;
          processedCount++;
        }

        this._items.set(currentItems);
        this._healthProgress.set({
          current: processedCount,
          total: totalCiphers,
          percent: Math.round((processedCount / totalCiphers) * 100),
        });

        // Update application at-risk counts after health checks
        this.updateApplicationAtRiskCounts();
      }),
      map((): void => undefined),
    );
  }

  // ============================================================================
  // Private Methods - Member Counts
  // ============================================================================

  private runMemberCountsLoading$(): Observable<void> {
    if (!this.organizationId || !this.currentUserId) {
      return of(undefined);
    }

    this._processingPhase.set(ProcessingPhase.LoadingMembers);
    this._progressMessage.set("Loading member access data...");

    const BATCH_SIZE = 200;
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE_MS = 100;

    return this.cipherAccessMappingService
      .getAllCiphersWithMemberAccessProgressive$(
        this.organizationId,
        this.currentUserId,
        this.allCiphers,
        BATCH_SIZE,
      )
      .pipe(
        tap((progressResult) => {
          const now = performance.now();
          const isComplete = progressResult.state === MemberAccessLoadState.Complete;
          const shouldUpdate = isComplete || now - lastUpdateTime >= UPDATE_THROTTLE_MS;

          if (shouldUpdate) {
            lastUpdateTime = now;
            this._memberProgress.set({
              current: progressResult.processedCount,
              total: progressResult.totalCipherCount,
              percent: progressResult.progressPercent,
            });

            this._progressMessage.set(
              `Loading member access: ${progressResult.processedCount}/${progressResult.totalCipherCount}`,
            );

            // Update items with member counts
            this.updateItemsWithMemberCounts(progressResult.processedCiphers);

            // Update application member counts
            this.updateApplicationsWithMemberCounts(progressResult.processedCiphers);
          }
        }),
        last(),
        map((): void => undefined),
        catchError((_err: unknown) => {
          // Member access error - silently continue for prototype
          return of(undefined);
        }),
      );
  }

  private updateItemsWithMemberCounts(
    processedCiphers: Array<{ cipher: CipherView; totalMemberCount: number }>,
  ): void {
    const currentItems = [...this._items()];
    let hasChanges = false;

    for (const processed of processedCiphers) {
      const index = this.cipherIndexMap.get(processed.cipher.id);
      if (index === undefined) {
        continue;
      }

      const item = currentItems[index];
      if (item.memberCount === processed.totalMemberCount) {
        continue;
      }

      currentItems[index] = this.riskInsightsService.updateItemWithMemberCount(
        item,
        processed.totalMemberCount,
      );
      hasChanges = true;
    }

    if (hasChanges) {
      this._items.set(currentItems);
    }
  }

  // ============================================================================
  // Private Methods - HIBP Checks
  // ============================================================================

  private runHibpChecks$(): Observable<void> {
    const validCiphers = this.allCiphers.filter(
      (c) => c.login?.password && !c.isDeleted && c.viewPassword,
    );

    if (validCiphers.length === 0) {
      return of(undefined);
    }

    return this.passwordHealthService.auditPasswordLeaksProgressive$(validCiphers, 500).pipe(
      tap((result) => {
        this._hibpProgress.set({
          current: result.checkedCount,
          total: result.totalCount,
          percent: result.progressPercent,
        });

        this._progressMessage.set(
          `Checking exposed passwords: ${result.checkedCount}/${result.totalCount}`,
        );

        // Update items with exposed password data
        this.updateItemsWithExposedPasswords(result.exposedPasswords);
      }),
      last(),
      map((): void => undefined),
    );
  }

  private updateItemsWithExposedPasswords(
    exposedPasswords: Array<{ cipherId: string; exposedXTimes: number }>,
  ): void {
    const currentItems = [...this._items()];
    const exposedMap = new Map(exposedPasswords.map((ep) => [ep.cipherId, ep.exposedXTimes]));
    let hasChanges = false;

    // Update exposed items
    for (const [cipherId, exposedCount] of exposedMap) {
      const index = this.cipherIndexMap.get(cipherId);
      if (index === undefined) {
        continue;
      }

      const item = currentItems[index];
      currentItems[index] = this.riskInsightsService.updateItemWithExposedPassword(
        item,
        exposedCount,
        this._enableWeakPassword(),
        this._enableReusedPassword(),
        this._enableHibp(),
      );
      hasChanges = true;
    }

    // Mark items not in exposed list as not exposed
    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      if (item.exposedPassword === null && !exposedMap.has(item.cipherId)) {
        currentItems[i] = this.riskInsightsService.updateItemWithExposedPassword(
          item,
          0,
          this._enableWeakPassword(),
          this._enableReusedPassword(),
          this._enableHibp(),
        );
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this._items.set(currentItems);

      // Update application at-risk counts after HIBP updates
      this.updateApplicationAtRiskCounts();
    }
  }

  // ============================================================================
  // Private Methods - Finalization
  // ============================================================================

  /**
   * Finalize item statuses when no HIBP check is enabled.
   * Sets all items to healthy if no checks are enabled, or calculates final status.
   */
  private finalizeItemStatuses(): void {
    const enableWeak = this._enableWeakPassword();
    const enableReused = this._enableReusedPassword();
    const enableHibp = this._enableHibp();

    const currentItems = [...this._items()];
    let hasChanges = false;

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];

      // If no checks enabled, mark as healthy
      if (!enableWeak && !enableReused && !enableHibp) {
        if (item.status !== RiskInsightsItemStatus.Healthy) {
          currentItems[i] = {
            ...item,
            status: RiskInsightsItemStatus.Healthy,
          };
          hasChanges = true;
        }
        continue;
      }

      // Calculate final status based on enabled checks
      const newStatus = calculateRiskStatus(
        item.weakPassword,
        item.reusedPassword,
        enableHibp ? item.exposedPassword : false, // If HIBP not enabled, don't count as factor
        enableWeak,
        enableReused,
        enableHibp,
      );

      if (item.status !== newStatus) {
        currentItems[i] = {
          ...item,
          status: newStatus,
        };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this._items.set(currentItems);
    }
  }

  // ============================================================================
  // Private Methods - Application Aggregation
  // ============================================================================

  /**
   * Builds application aggregations from the loaded ciphers.
   * Called after Phase 1 cipher loading completes.
   * Creates an application entry for each unique domain found across all ciphers.
   */
  private buildApplicationAggregations(): void {
    const applicationMap = new Map<string, RiskInsightsApplication>();

    // Clear existing maps
    this.cipherToApplicationsMap.clear();
    this.applicationToCiphersMap.clear();

    for (const cipher of this.allCiphers) {
      const domains = getTrimmedCipherUris(cipher);

      // Track which applications this cipher belongs to
      this.cipherToApplicationsMap.set(cipher.id, domains);

      for (const domain of domains) {
        // Track which ciphers belong to each application
        if (!this.applicationToCiphersMap.has(domain)) {
          this.applicationToCiphersMap.set(domain, []);
        }
        this.applicationToCiphersMap.get(domain)!.push(cipher.id);

        // Create or update application entry
        if (!applicationMap.has(domain)) {
          applicationMap.set(domain, {
            domain,
            passwordCount: 0,
            atRiskPasswordCount: 0,
            memberIds: new Set<string>(),
            atRiskMemberIds: new Set<string>(),
            memberAccessPending: true,
            cipherIds: [],
          });
        }

        const app = applicationMap.get(domain)!;
        app.passwordCount++;
        app.cipherIds.push(cipher.id);
      }
    }

    // Convert to array and sort by password count descending
    const applications = Array.from(applicationMap.values()).sort(
      (a, b) => b.passwordCount - a.passwordCount,
    );

    this._applications.set(applications);
  }

  /**
   * Updates application member counts when cipher member data arrives.
   * Called incrementally during Phase 3 member loading.
   *
   * @param processedCiphers - Ciphers with their member access data
   */
  private updateApplicationsWithMemberCounts(processedCiphers: CipherWithMemberAccess[]): void {
    const currentApplications = this._applications();
    const items = this._items();
    const itemMap = new Map(items.map((item) => [item.cipherId, item]));

    // Build a domain -> Set<memberIds> map
    const domainMemberMap = new Map<string, Set<string>>();
    const domainAtRiskMemberMap = new Map<string, Set<string>>();

    for (const processed of processedCiphers) {
      const cipherId = processed.cipher.id;
      const domains = this.cipherToApplicationsMap.get(cipherId) ?? [];
      const memberIds = processed.members.map((m) => m.userId);

      // Store cipher member IDs for at-risk member tracking
      this.cipherToMemberIdsMap.set(cipherId, new Set(memberIds));

      // Check if this cipher is at-risk
      const item = itemMap.get(cipherId);
      const isAtRisk = item?.status === RiskInsightsItemStatus.AtRisk;

      for (const domain of domains) {
        // Add all members to domain's member set
        if (!domainMemberMap.has(domain)) {
          domainMemberMap.set(domain, new Set<string>());
        }
        for (const memberId of memberIds) {
          domainMemberMap.get(domain)!.add(memberId);
        }

        // If cipher is at-risk, add members to at-risk set
        if (isAtRisk) {
          if (!domainAtRiskMemberMap.has(domain)) {
            domainAtRiskMemberMap.set(domain, new Set<string>());
          }
          for (const memberId of memberIds) {
            domainAtRiskMemberMap.get(domain)!.add(memberId);
          }
        }
      }
    }

    // Update applications with member data
    const updatedApplications: RiskInsightsApplication[] = currentApplications.map((app) => {
      const memberIds = domainMemberMap.get(app.domain) ?? app.memberIds;
      const atRiskMemberIds = domainAtRiskMemberMap.get(app.domain) ?? app.atRiskMemberIds;

      return {
        ...app,
        memberIds: new Set<string>(memberIds),
        atRiskMemberIds: new Set<string>(atRiskMemberIds),
        memberAccessPending: false,
      };
    });

    this._applications.set(updatedApplications);
  }

  /**
   * Updates application at-risk counts based on current item statuses.
   * Called after health checks complete or when item statuses change.
   */
  private updateApplicationAtRiskCounts(): void {
    const items = this._items();
    const itemMap = new Map(items.map((item) => [item.cipherId, item]));
    const currentApplications = this._applications();

    const updatedApplications = currentApplications.map((app) => {
      let atRiskCount = 0;
      const atRiskMemberIds = new Set<string>();

      for (const cipherId of app.cipherIds) {
        const item = itemMap.get(cipherId);
        if (item?.status === RiskInsightsItemStatus.AtRisk) {
          atRiskCount++;

          // Add members of at-risk ciphers to at-risk member set
          const cipherMemberIds = this.cipherToMemberIdsMap.get(cipherId);
          if (cipherMemberIds) {
            for (const memberId of cipherMemberIds) {
              atRiskMemberIds.add(memberId);
            }
          }
        }
      }

      return {
        ...app,
        atRiskPasswordCount: atRiskCount,
        atRiskMemberIds,
      };
    });

    this._applications.set(updatedApplications);
  }
}
