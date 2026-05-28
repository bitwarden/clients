import { Injectable } from "@angular/core";
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  filter,
  finalize,
  from,
  map,
  mergeMap,
  Observable,
  shareReplay,
  switchMap,
  tap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import {
  CipherRiskService,
  PersonalVaultRiskProgress,
  PersonalVaultRiskSummary,
  PersonalVaultRiskUpdate,
} from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { AlertExclusionService } from "@bitwarden/common/vault/alert-exclusions";
import { CipherRiskTypes } from "@bitwarden/common/vault/enums/cipher-risk-types";
import { AlertExclusionData } from "@bitwarden/common/vault/models/data/alert-exclusion.data";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

export type PersonalVaultAlertSummary = PersonalVaultRiskSummary & { totalCount: number };

@Injectable()
export class PersonalVaultAlertService {
  private scanning$ = new BehaviorSubject<boolean>(false);

  // Dedupe in-flight auto-undismiss DELETEs so a slow round-trip doesn't trigger
  // the same removal twice while the exclusion is still in local state.
  private readonly autoUndismissInFlight = new Set<string>();

  readonly isScanning$: Observable<boolean> = this.scanning$.asObservable();

  private userId$ = this.accountService.activeAccount$.pipe(getUserId, filterOutNullish());

  private rawUpdates$: Observable<PersonalVaultRiskUpdate> = this.userId$.pipe(
    switchMap((userId) =>
      this.cipherRiskService.computeRiskForPersonalVault(userId).pipe(
        tap({ subscribe: () => this.scanning$.next(true) }),
        finalize(() => this.scanning$.next(false)),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly progress$: Observable<PersonalVaultRiskProgress> = this.rawUpdates$.pipe(
    filter((u): u is PersonalVaultRiskProgress => u.type === "progress"),
  );

  readonly rawSummary$: Observable<PersonalVaultRiskSummary> = this.rawUpdates$.pipe(
    filter((u): u is Extract<PersonalVaultRiskUpdate, { type: "result" }> => u.type === "result"),
    map((u) => u.summary),
  );

  readonly summary$: Observable<PersonalVaultAlertSummary> = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([this.rawSummary$, this.alertExclusionService.exclusions$(userId)]),
    ),
    map(([summary, exclusions]) => {
      const exclusionByCipher = new Map(exclusions.map((e) => [e.cipherId, e]));
      const isCovered = (cipherId: string, flag: CipherRiskTypes) => {
        const ex = exclusionByCipher.get(cipherId as CipherId);
        return ex != null && (ex.riskTypes & flag) !== 0;
      };

      const exposed = summary.exposed.filter((c) => !isCovered(c.id, CipherRiskTypes.Exposed));
      const weak = summary.weak.filter((c) => !isCovered(c.id, CipherRiskTypes.Weak));
      const reused = summary.reused.filter((c) => !isCovered(c.id, CipherRiskTypes.Reused));

      return {
        exposed,
        weak,
        reused,
        riskCounts: summary.riskCounts,
        scannedAt: summary.scannedAt,
        totalCount: exposed.length + weak.length + reused.length,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly totalCount$: Observable<number> = this.summary$.pipe(map((s) => s.totalCount));

  /**
   * Side-effect stream: when a scan finds a risk on a cipher that its exclusion record does
   * NOT cover (e.g. excluded for weak, now also exposed), DELETE the exclusion so the cipher
   * re-surfaces in every category it currently has risk in. Subscribe with `takeUntilDestroyed`
   * from the report UI.
   */
  readonly autoUndismiss$: Observable<void> = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([this.rawSummary$, this.alertExclusionService.exclusions$(userId)]).pipe(
        mergeMap(([summary, exclusions]) => {
          const toRemove = exclusions.filter((ex) =>
            this.hasUncoveredRisk(ex, summary.riskCounts.get(ex.cipherId as CipherId)),
          );
          if (toRemove.length === 0) {
            return EMPTY;
          }
          return from(this.removeExclusions(toRemove, userId as UserId));
        }),
      ),
    ),
  );

  constructor(
    private accountService: AccountService,
    private cipherRiskService: CipherRiskService,
    private alertExclusionService: AlertExclusionService,
  ) {}

  private hasUncoveredRisk(
    exclusion: AlertExclusionData,
    counts: { exposedBreaches: number; reuseCount: number; weak: boolean } | undefined,
  ): boolean {
    if (counts == null) {
      // Cipher has no current risk this scan; the exclusion's reason may still apply later.
      return false;
    }
    if (this.autoUndismissInFlight.has(exclusion.id)) {
      return false;
    }
    let currentMask = 0;
    if (counts.exposedBreaches > 0) {
      currentMask |= CipherRiskTypes.Exposed;
    }
    if (counts.weak) {
      currentMask |= CipherRiskTypes.Weak;
    }
    if (counts.reuseCount > 1) {
      currentMask |= CipherRiskTypes.Reused;
    }
    return (currentMask & ~exclusion.riskTypes) !== 0;
  }

  private async removeExclusions(exclusions: AlertExclusionData[], userId: UserId): Promise<void> {
    for (const ex of exclusions) {
      this.autoUndismissInFlight.add(ex.id);
      try {
        await this.alertExclusionService.removeExclusion(ex.id, userId);
      } finally {
        this.autoUndismissInFlight.delete(ex.id);
      }
    }
  }
}
