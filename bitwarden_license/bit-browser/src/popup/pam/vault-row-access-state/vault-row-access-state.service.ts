import { Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Observable, Subject, catchError, from, of, shareReplay, startWith, switchMap } from "rxjs";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  type CipherAccessStateView,
} from "@bitwarden/bit-common/pam";

/** One cached access-state read per gated cipher in the popup vault list, re-read on {@link invalidate}. */
@Injectable({ providedIn: "root" })
export class VaultRowAccessStateService {
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);

  constructor() {
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
