import { Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  from,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  type CipherAccessStateView,
} from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

/**
 * One cached access-state read per gated cipher in the popup vault list, re-read on
 * {@link invalidate}. The cache belongs to the active account: the popup document survives an
 * account switch, so it is dropped on one rather than replaying the previous account's state.
 */
@Injectable({ providedIn: "root" })
export class VaultRowAccessStateService {
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);

  constructor() {
    inject(AccountService)
      .activeAccount$.pipe(
        map((account) => account?.id ?? null),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reset());

    inject(AccessRefreshService)
      .accessChanged$()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.refresh.forEach((subject) => subject.next()));
  }

  private readonly refresh = new Map<string, Subject<void>>();
  private readonly state = new Map<string, Observable<CipherAccessStateView | null>>();

  /** `cipherId`'s access state, read once and replayed to every subscriber until {@link invalidate}. */
  state$(cipherId: string): Observable<CipherAccessStateView | null> {
    let state$ = this.state.get(cipherId);
    if (state$ == null) {
      state$ = this.refreshSubject(cipherId).pipe(
        startWith(undefined),
        switchMap(() =>
          from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
            catchError(() => of(null)),
          ),
        ),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.state.set(cipherId, state$);
    }
    return state$;
  }

  private reset(): void {
    // Completing the triggers lets the old accounts' shared reads wind down.
    this.refresh.forEach((subject) => subject.complete());
    this.refresh.clear();
    this.state.clear();
  }

  /** Forces the next read of `cipherId` to hit the SDK again. */
  invalidate(cipherId: string): void {
    this.refreshSubject(cipherId).next();
  }

  private refreshSubject(cipherId: string): Subject<void> {
    let subject = this.refresh.get(cipherId);
    if (subject == null) {
      subject = new Subject<void>();
      this.refresh.set(cipherId, subject);
    }
    return subject;
  }
}
