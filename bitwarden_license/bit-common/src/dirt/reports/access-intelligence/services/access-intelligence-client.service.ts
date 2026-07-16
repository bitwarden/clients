import { Injectable, Signal, inject, signal } from "@angular/core";
import {
  Observable,
  catchError,
  combineLatest,
  forkJoin,
  from,
  map,
  mergeMap,
  of,
  shareReplay,
  switchMap,
  take,
  tap,
  toArray,
} from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AccessIntelligenceClientServiceAbstraction,
  AccessIntelligenceCipher,
  AccessIntelligenceProgress,
  AccessIntelligenceResult,
  AccessIntelligenceState,
  CipherHealthResult,
  CipherMemberAccessInfo,
  createInitialProgress,
  createProgress,
  isAtRiskCipher,
} from "@bitwarden/common/dirt/reports/access-intelligence";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

/**
 * Internal interface for organization data needed for member mapping
 */
interface OrganizationData {
  collectionMap: Map<string, CollectionAdminView>;
  groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>;
  userEmailMap: Map<string, string>;
}

/**
 * Internal interface for HIBP check results
 */
interface HibpResult {
  cipherId: string;
  exposedCount: number;
}

/**
 * Service for analyzing organization ciphers for password health and member access.
 *
 * This service:
 * - Loads all ciphers upfront
 * - Runs health checks (weak, reused, HIBP) in parallel
 * - Loads organization data (collections, users, groups) in parallel with health checks
 * - Maps ciphers to members once base data is loaded
 */
@Injectable()
export class AccessIntelligenceClientService implements AccessIntelligenceClientServiceAbstraction {
  private readonly cipherService = inject(CipherService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly apiService = inject(ApiService);
  private readonly auditService = inject(AuditService);
  private readonly passwordStrengthService = inject(PasswordStrengthServiceAbstraction);
  private readonly accountService = inject(AccountService);
  private readonly logService = inject(LogService);

  // State signals (per ADR-0027)
  private readonly _state = signal<AccessIntelligenceState>(AccessIntelligenceState.Idle);
  private readonly _error = signal<string | null>(null);
  private readonly _cipherProgress = signal<AccessIntelligenceProgress>(createInitialProgress());
  private readonly _healthProgress = signal<AccessIntelligenceProgress>(createInitialProgress());
  private readonly _memberProgress = signal<AccessIntelligenceProgress>(createInitialProgress());
  private readonly _result = signal<AccessIntelligenceResult | null>(null);

  // Public readonly signals
  readonly state: Signal<AccessIntelligenceState> = this._state.asReadonly();
  readonly error: Signal<string | null> = this._error.asReadonly();
  readonly cipherProgress: Signal<AccessIntelligenceProgress> = this._cipherProgress.asReadonly();
  readonly healthProgress: Signal<AccessIntelligenceProgress> = this._healthProgress.asReadonly();
  readonly memberProgress: Signal<AccessIntelligenceProgress> = this._memberProgress.asReadonly();
  readonly result: Signal<AccessIntelligenceResult | null> = this._result.asReadonly();

  /**
   * Start access intelligence processing for an organization
   */
  start(organizationId: OrganizationId): void {
    this.reset();
    this._state.set(AccessIntelligenceState.LoadingCiphers);

    this.logService.info(
      `[AccessIntelligenceClientService] Starting analysis for organization ${organizationId}`,
    );

    this.executeFlow$(organizationId).subscribe({
      next: (result: AccessIntelligenceResult) => {
        this._result.set(result);
        this._state.set(AccessIntelligenceState.Complete);
        this.logService.info(
          `[AccessIntelligenceClientService] Analysis complete: ${result.totalCipherCount} ciphers, ${result.atRiskCipherCount} at risk`,
        );
      },
      error: (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        this._error.set(errorMessage);
        this._state.set(AccessIntelligenceState.Error);
        this.logService.error(`[AccessIntelligenceClientService] Analysis failed`, err);
      },
    });
  }

  /**
   * Reset the service to its initial state
   */
  reset(): void {
    this._state.set(AccessIntelligenceState.Idle);
    this._error.set(null);
    this._cipherProgress.set(createInitialProgress());
    this._healthProgress.set(createInitialProgress());
    this._memberProgress.set(createInitialProgress());
    this._result.set(null);
  }

  /**
   * Main execution flow - orchestrates the parallel operations
   */
  private executeFlow$(organizationId: OrganizationId): Observable<AccessIntelligenceResult> {
    // (1) Load ciphers first
    const ciphers$ = from(this.cipherService.getAllFromApiForOrganization(organizationId)).pipe(
      tap((ciphers) => {
        this.logService.info(`[AccessIntelligenceClientService] Loaded ${ciphers.length} ciphers`);
        this._cipherProgress.set(createProgress(ciphers.length, ciphers.length));
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // Get current user ID for collection fetching
    const currentUserId$ = this.accountService.activeAccount$.pipe(
      take(1),
      map((account) => account?.id as UserId),
    );

    // (2a) Health checks - starts as soon as ciphers arrive
    const healthResults$ = ciphers$.pipe(
      tap(() => this._state.set(AccessIntelligenceState.ProcessingHealth)),
      switchMap((ciphers) => this.runAllHealthChecks$(ciphers)),
      tap((healthMap) => {
        this.logService.info(
          `[AccessIntelligenceClientService] Health checks complete for ${healthMap.size} ciphers`,
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // (2b) Org data - loads in parallel with health checks
    const orgData$ = combineLatest([ciphers$, currentUserId$]).pipe(
      tap(() => this._state.set(AccessIntelligenceState.LoadingOrganizationData)),
      switchMap(([, userId]) => this.loadOrganizationData$(organizationId, userId)),
      tap((orgData) => {
        this.logService.info(
          `[AccessIntelligenceClientService] Org data loaded: ${orgData.collectionMap.size} collections, ${orgData.userEmailMap.size} users`,
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // (3) Member mapping - when org data is ready
    const ciphersWithMembers$ = combineLatest([ciphers$, orgData$]).pipe(
      tap(() => this._state.set(AccessIntelligenceState.MappingAccess)),
      switchMap(([ciphers, orgData]) => this.mapCiphersToMembers$(ciphers, orgData)),
      tap((mappings) => {
        this.logService.info(
          `[AccessIntelligenceClientService] Member mapping complete for ${mappings.size} ciphers`,
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // (4) Combine all results into final output
    return combineLatest([ciphers$, healthResults$, ciphersWithMembers$]).pipe(
      map(([ciphers, healthMap, memberMap]) =>
        this.buildFinalResult(ciphers, healthMap, memberMap),
      ),
    );
  }

  /**
   * Run all health checks in parallel using forkJoin
   */
  private runAllHealthChecks$(ciphers: CipherView[]): Observable<Map<string, CipherHealthResult>> {
    const validCiphers = ciphers.filter((c) => this.isValidCipher(c));
    const totalChecks = validCiphers.length;

    if (totalChecks === 0) {
      this._healthProgress.set(createProgress(0, 0));
      return of(new Map());
    }

    this._healthProgress.set(createProgress(0, totalChecks));

    // Build password use map for reuse detection (synchronous)
    const passwordUseMap = this.buildPasswordUseMap(validCiphers);

    // Check weak passwords (synchronous, fast)
    const weakResults = this.checkWeakPasswords(validCiphers);

    // Run HIBP checks (asynchronous, API calls)
    return this.runHibpChecks$(validCiphers).pipe(
      map((hibpResults) => {
        return this.combineHealthResults(validCiphers, weakResults, hibpResults, passwordUseMap);
      }),
      tap(() => this._healthProgress.set(createProgress(totalChecks, totalChecks))),
    );
  }

  /**
   * Check weak passwords for all valid ciphers
   */
  private checkWeakPasswords(
    ciphers: CipherView[],
  ): Map<string, { isWeak: boolean; score?: number }> {
    const results = new Map<string, { isWeak: boolean; score?: number }>();

    for (const cipher of ciphers) {
      const username = cipher.login?.username;
      const userInput =
        username && !Utils.isNullOrWhitespace(username)
          ? this.extractUsernameParts(username)
          : undefined;

      const { score } = this.passwordStrengthService.getPasswordStrength(
        cipher.login.password!,
        undefined,
        userInput,
      );

      // Score <= 2 is considered weak (0=terrible, 1=bad, 2=weak, 3=good, 4=strong)
      const isWeak = score != null && score <= 2;
      results.set(cipher.id, { isWeak, score: score ?? undefined });
    }

    return results;
  }

  /**
   * Extract username parts for password strength evaluation
   */
  private extractUsernameParts(username: string): string[] {
    const atPosition = username.indexOf("@");
    const userNameToProcess = atPosition > -1 ? username.substring(0, atPosition) : username;
    return userNameToProcess
      .trim()
      .toLowerCase()
      .split(/[^A-Za-z0-9]/);
  }

  /**
   * Run HIBP checks with concurrency limit
   */
  private runHibpChecks$(ciphers: CipherView[]): Observable<HibpResult[]> {
    if (ciphers.length === 0) {
      return of([]);
    }

    let checkedCount = 0;
    const totalCount = ciphers.length;

    return from(ciphers).pipe(
      mergeMap(
        (cipher) =>
          from(this.auditService.passwordLeaked(cipher.login.password!)).pipe(
            map((exposedCount) => {
              checkedCount++;
              // Update progress periodically (every 50 checks)
              if (checkedCount % 50 === 0 || checkedCount === totalCount) {
                this._healthProgress.set(createProgress(checkedCount, totalCount));
              }
              return { cipherId: cipher.id, exposedCount };
            }),
            catchError(() => {
              // If HIBP check fails for a cipher, treat it as not exposed
              checkedCount++;
              return of({ cipherId: cipher.id, exposedCount: 0 });
            }),
          ),
        100, // Concurrency limit
      ),
      toArray(),
    );
  }

  /**
   * Build a map of password hashes to cipher IDs for detecting reused passwords
   */
  private buildPasswordUseMap(ciphers: CipherView[]): Map<string, string[]> {
    const passwordUseMap = new Map<string, string[]>();

    for (const cipher of ciphers) {
      const password = cipher.login?.password;
      if (!password) {
        continue;
      }

      const passwordKey = this.hashPassword(password);
      const existing = passwordUseMap.get(passwordKey);
      if (existing) {
        existing.push(cipher.id);
      } else {
        passwordUseMap.set(passwordKey, [cipher.id]);
      }
    }

    return passwordUseMap;
  }

  /**
   * Simple hash function for password deduplication
   */
  private hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Combine weak, reused, and HIBP results into health results map
   */
  private combineHealthResults(
    ciphers: CipherView[],
    weakResults: Map<string, { isWeak: boolean; score?: number }>,
    hibpResults: HibpResult[],
    passwordUseMap: Map<string, string[]>,
  ): Map<string, CipherHealthResult> {
    const healthMap = new Map<string, CipherHealthResult>();
    const hibpMap = new Map(hibpResults.map((r) => [r.cipherId, r.exposedCount]));

    for (const cipher of ciphers) {
      const weak = weakResults.get(cipher.id) ?? { isWeak: false };
      const exposedCount = hibpMap.get(cipher.id) ?? 0;

      // Check if password is reused
      const passwordKey = this.hashPassword(cipher.login.password!);
      const usedBy = passwordUseMap.get(passwordKey);
      const isReused = usedBy !== undefined && usedBy.length > 1;

      healthMap.set(cipher.id, {
        cipherId: cipher.id,
        isWeak: weak.isWeak,
        weakScore: weak.score,
        isReused,
        isExposed: exposedCount > 0,
        exposedCount: exposedCount > 0 ? exposedCount : undefined,
      });
    }

    return healthMap;
  }

  /**
   * Load organization data (collections, users, groups)
   */
  private loadOrganizationData$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<OrganizationData> {
    // Fetch collections and users in parallel
    const collections$ = this.collectionAdminService
      .collectionAdminViews$(organizationId, currentUserId)
      .pipe(take(1));

    const usersAndGroups$ = from(this.fetchOrganizationUsersAndGroups(organizationId));

    return forkJoin([collections$, usersAndGroups$]).pipe(
      map(([collections, { groupMemberMap, userEmailMap }]) => {
        const collectionMap = new Map<string, CollectionAdminView>();
        collections.forEach((c) => collectionMap.set(c.id, c));

        return { collectionMap, groupMemberMap, userEmailMap };
      }),
    );
  }

  /**
   * Fetch organization users and groups in a single optimized call
   */
  private async fetchOrganizationUsersAndGroups(organizationId: OrganizationId): Promise<{
    groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>;
    userEmailMap: Map<string, string>;
  }> {
    // Fetch users and groups in parallel
    const [orgUsersResponse, groupsResponse] = await Promise.all([
      this.organizationUserApiService.getAllUsers(organizationId, { includeGroups: true }),
      this.fetchGroupNames(organizationId),
    ]);

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
  }

  /**
   * Fetch group names for an organization
   */
  private async fetchGroupNames(
    organizationId: OrganizationId,
  ): Promise<{ id: string; name: string }[]> {
    try {
      const response = await this.apiService.send(
        "GET",
        `/organizations/${organizationId}/groups`,
        null,
        true,
        true,
      );

      if (response?.data && Array.isArray(response.data)) {
        return response.data.map((g: { id: string; name: string }) => ({
          id: g.id,
          name: g.name,
        }));
      }

      return [];
    } catch {
      this.logService.warning(
        `[AccessIntelligenceClientService] Failed to fetch group names for org ${organizationId}`,
      );
      return [];
    }
  }

  /**
   * Map ciphers to their member access
   */
  private mapCiphersToMembers$(
    ciphers: CipherView[],
    orgData: OrganizationData,
  ): Observable<Map<string, CipherMemberAccessInfo[]>> {
    const memberMap = new Map<string, CipherMemberAccessInfo[]>();
    const totalCiphers = ciphers.length;

    this._memberProgress.set(createProgress(0, totalCiphers));

    let processedCount = 0;

    for (const cipher of ciphers) {
      const members = this.getCipherMembers(cipher, orgData);
      memberMap.set(cipher.id, members);

      processedCount++;
      // Update progress every 100 ciphers
      if (processedCount % 100 === 0 || processedCount === totalCiphers) {
        this._memberProgress.set(createProgress(processedCount, totalCiphers));
      }
    }

    return of(memberMap);
  }

  /**
   * Get all members with access to a cipher
   */
  private getCipherMembers(
    cipher: CipherView,
    orgData: OrganizationData,
  ): CipherMemberAccessInfo[] {
    const memberMap = new Map<string, CipherMemberAccessInfo>();

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
   * Build the final result from all collected data
   */
  private buildFinalResult(
    ciphers: CipherView[],
    healthMap: Map<string, CipherHealthResult>,
    memberMap: Map<string, CipherMemberAccessInfo[]>,
  ): AccessIntelligenceResult {
    const resultCiphers: AccessIntelligenceCipher[] = [];
    const uniqueMembers = new Set<string>();
    const atRiskMembers = new Set<string>();

    for (const cipher of ciphers) {
      // Only include valid ciphers in results
      if (!this.isValidCipher(cipher)) {
        continue;
      }

      const health = healthMap.get(cipher.id) ?? {
        cipherId: cipher.id,
        isWeak: false,
        isReused: false,
        isExposed: false,
      };

      const members = memberMap.get(cipher.id) ?? [];
      const memberCount = members.length;

      // Track unique members
      for (const member of members) {
        uniqueMembers.add(member.userId);

        // Track at-risk members
        if (isAtRiskCipher(health)) {
          atRiskMembers.add(member.userId);
        }
      }

      resultCiphers.push({
        cipher,
        health,
        members,
        memberCount,
      });
    }

    const atRiskCipherCount = resultCiphers.filter((c) => isAtRiskCipher(c.health)).length;

    return {
      ciphers: resultCiphers,
      totalCipherCount: resultCiphers.length,
      atRiskCipherCount,
      totalMemberCount: uniqueMembers.size,
      atRiskMemberCount: atRiskMembers.size,
    };
  }

  /**
   * Validates that the cipher is a login item with a valid password
   */
  private isValidCipher(cipher: CipherView): boolean {
    if (!cipher) {
      return false;
    }

    const { type, login, isDeleted, viewPassword } = cipher;

    if (
      type !== CipherType.Login ||
      !login?.password ||
      Utils.isNullOrWhitespace(login.password) ||
      isDeleted ||
      !viewPassword
    ) {
      return false;
    }

    return true;
  }
}
