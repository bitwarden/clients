import { Injectable } from "@angular/core";
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  tap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  CipherRiskService,
  PersonalVaultRiskSummary,
} from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { AlertDismissalService } from "@bitwarden/common/vault/alert-dismissals";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

export type PersonalVaultAlertSummary = PersonalVaultRiskSummary & { totalCount: number };

@Injectable()
export class PersonalVaultAlertService {
  private rescan$ = new Subject<void>();
  private scanning$ = new BehaviorSubject<boolean>(false);

  readonly isScanning$: Observable<boolean> = this.scanning$.asObservable();

  private userId$ = this.accountService.activeAccount$.pipe(getUserId, filterOutNullish());

  private scanResult$: Observable<PersonalVaultRiskSummary> = combineLatest([
    this.userId$,
    this.rescan$.pipe(startWith(undefined)),
  ]).pipe(
    switchMap(([userId]) => {
      this.scanning$.next(true);
      return this.cipherRiskService
        .computeRiskForPersonalVault(userId)
        .pipe(tap(() => this.scanning$.next(false)));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly summary$: Observable<PersonalVaultAlertSummary> = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([this.scanResult$, this.alertDismissalService.dismissals$(userId)]),
    ),
    map(([summary, dismissals]) => {
      const dismissedIds = new Set(dismissals.map((d) => d.cipherId as string));
      const filterDismissed = (ciphers: CipherView[]) =>
        ciphers.filter((c) => !dismissedIds.has(c.id));

      const exposed = filterDismissed(summary.exposed);
      const weak = filterDismissed(summary.weak);
      const reused = filterDismissed(summary.reused);

      return {
        exposed,
        weak,
        reused,
        scannedAt: summary.scannedAt,
        totalCount: exposed.length + weak.length + reused.length,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly totalCount$: Observable<number> = this.summary$.pipe(map((s) => s.totalCount));

  readonly rawSummary$: Observable<PersonalVaultRiskSummary> = this.scanResult$;

  constructor(
    private accountService: AccountService,
    private cipherRiskService: CipherRiskService,
    private alertDismissalService: AlertDismissalService,
  ) {}

  rescan(): void {
    this.rescan$.next();
  }
}
