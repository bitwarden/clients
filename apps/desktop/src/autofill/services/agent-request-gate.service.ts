import { Injectable, OnDestroy } from "@angular/core";
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  NEVER,
  Observable,
  of,
  race,
  skip,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  timeout,
  TimeoutError,
  timer,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, ToastService } from "@bitwarden/components";

export type AgentGateRequest<T> = {
  label: string; // logs only
  requestId?: number; // main's broker id; a re-send is ignored while the first is in flight
  enabled: Observable<boolean>; // waits for the first value; false refuses without touching the vault
  deadline: number; // epoch ms; bounds the unlock wait
  unlock: { requiredMessage: string; timeoutMessage?: string }; // i18n keys; no timeoutMessage = silent timeout
  refused: T; // disabled, failures, account gone after unlock
  locked?: T; // still locked at the deadline; defaults to refused
  expired?: T; // deadline passed before handle(); defaults to refused
  exclusive?: boolean; // default true: one handle() at a time across all requests, so dialogs never stack
  handle: (userId: UserId) => Promise<T>;
  respond: (answer: T) => Promise<void>; // called exactly once per request
};

// Unlock, remember-until-lock and approval stages shared by the desktop agents.
@Injectable({ providedIn: "root" })
export class AgentRequestGate implements OnDestroy {
  // Cleared on lock, account switch and destroy. Callers namespace keys.
  readonly remembered: { has(key: string): boolean; add(key: string): void; clear(): void } =
    new Set<string>();

  private exclusiveQueue: Promise<unknown> = Promise.resolve();
  private inFlight = new Set<number>();
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private accountService: AccountService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private logService: LogService,
  ) {
    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status !== AuthenticationStatus.Unlocked),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.remembered.clear());

    // Account switch is a lock boundary.
    this.accountService.activeAccount$
      .pipe(
        // activeAccount$ also re-emits when AccountInfo fields change.
        distinctUntilChanged((a, b) => a?.id === b?.id),
        skip(1),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.logService.debug("Active account changed, clearing remembered agent approvals");
          this.remembered.clear();
        },
        error: (e: unknown) => {
          this.logService.error("Error in active account observable", e);
          this.remembered.clear();
        },
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.remembered.clear();
  }

  async run<T>(request: AgentGateRequest<T>): Promise<void> {
    const { requestId } = request;
    if (requestId != null) {
      if (this.inFlight.has(requestId)) {
        return;
      }
      this.inFlight.add(requestId);
    }
    let answer = request.refused;
    try {
      answer = await this.answer(request);
    } catch (error: unknown) {
      this.logService.error(`${request.label}: refusing after an error`, error);
    }
    try {
      await request.respond(answer);
    } catch (error: unknown) {
      this.logService.error(`${request.label}: failed to respond`, error);
    } finally {
      if (requestId != null) {
        this.inFlight.delete(requestId);
      }
    }
  }

  async confirm<R>(open: () => DialogRef<R>, deadline?: number): Promise<R | undefined> {
    ipc.platform.focusWindow();
    const dialogRef = open();
    const expired$ =
      deadline == null
        ? NEVER
        : timer(new Date(deadline)).pipe(
            tap(() => void dialogRef.close()),
            map((): undefined => undefined),
          );
    return firstValueFrom(race(dialogRef.closed, expired$));
  }

  private async answer<T>(request: AgentGateRequest<T>): Promise<T> {
    const enabled = await firstValueFrom(request.enabled.pipe(takeUntil(this.destroy$)), {
      defaultValue: false,
    });
    if (!enabled) {
      return request.refused;
    }

    let userId: UserId | undefined;
    try {
      userId = await this.unlockedUserId(request.unlock, request.deadline);
    } catch (error: unknown) {
      if (!(error instanceof TimeoutError)) {
        throw error;
      }
      if (request.unlock.timeoutMessage != null) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t(request.unlock.timeoutMessage),
        });
      }
      return request.locked ?? request.refused;
    }

    if (userId == null) {
      this.logService.error(`${request.label}: no active account after unlock; refusing`);
      return request.refused;
    }
    // A request queued past its deadline has no one waiting: don't decrypt or open a dialog.
    const handle = async () =>
      Date.now() >= request.deadline
        ? (request.expired ?? request.refused)
        : request.handle(userId);
    return request.exclusive === false ? handle() : this.exclusively(handle);
  }

  private unlockedUserId(
    unlock: AgentGateRequest<unknown>["unlock"],
    deadline: number,
  ): Promise<UserId | undefined> {
    return firstValueFrom(
      combineLatest([
        this.authService.activeAccountStatus$,
        this.accountService.activeAccount$,
      ]).pipe(
        take(1),
        switchMap(([status, account]) => {
          if (status === AuthenticationStatus.Unlocked && account != null) {
            return of(account.id);
          }
          ipc.platform.focusWindow();
          this.toastService.showToast({
            variant: "info",
            message: this.i18nService.t(unlock.requiredMessage),
          });
          return this.authService.activeAccountStatus$.pipe(
            filter((s) => s === AuthenticationStatus.Unlocked),
            // First unlock only, or a later unlock replays an answered request.
            take(1),
            timeout({ first: new Date(deadline) }),
            // The active account may have switched during unlock.
            switchMap(() => this.accountService.activeAccount$.pipe(take(1))),
            map((a) => a?.id),
          );
        }),
        // Teardown refuses waiting requests rather than dropping them.
        takeUntil(this.destroy$),
      ),
    );
  }

  private exclusively<T>(handle: () => Promise<T>): Promise<T> {
    const result = this.exclusiveQueue.then(handle);
    this.exclusiveQueue = result.catch((): void => undefined);
    return result;
  }
}
