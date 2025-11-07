import {
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  pairwise,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { getOptionalUserId, getUserId } from "@bitwarden/common/auth/services/account.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

import {
  PendingAuthRequestsStateService,
  PendingAuthUserMarker,
} from "./pending-auth-requests.state";

export class DefaultAuthRequestAnsweringService implements AuthRequestAnsweringService {
  constructor(
    protected readonly accountService: AccountService,
    protected readonly authService: AuthService,
    protected readonly masterPasswordService: MasterPasswordServiceAbstraction,
    protected readonly messagingService: MessagingService,
    protected readonly pendingAuthRequestsState: PendingAuthRequestsStateService,
  ) {}

  async receivedPendingAuthRequest(userId: UserId, authRequestId: string): Promise<void> {
    throw new Error("receivedPendingAuthRequest() not implemented for this client");
  }

  async userMeetsConditionsToShowApprovalDialog(userId: UserId): Promise<boolean> {
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    const activeUserId: UserId | null = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    const forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(userId),
    );

    // User must be unlocked, active, and must not be required to set/change their master password
    const meetsConditions =
      authStatus === AuthenticationStatus.Unlocked &&
      activeUserId === userId &&
      forceSetPasswordReason === ForceSetPasswordReason.None;

    return meetsConditions;
  }

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    throw new Error("handleAuthRequestNotificationClicked() not implemented for this client");
  }

  async processPendingAuthRequests(): Promise<void> {
    // Prune any stale pending requests (older than 15 minutes)
    // This comes from GlobalSettings.cs
    //    public TimeSpan UserRequestExpiration { get; set; } = TimeSpan.FromMinutes(15);
    const fifteenMinutesMs = 15 * 60 * 1000;

    await this.pendingAuthRequestsState.pruneOlderThan(fifteenMinutesMs);

    const pendingAuthRequestsInState: PendingAuthUserMarker[] =
      (await firstValueFrom(this.pendingAuthRequestsState.getAll$())) ?? [];

    if (pendingAuthRequestsInState.length > 0) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const pendingAuthRequestsForActiveUser = pendingAuthRequestsInState.some(
        (e) => e.userId === activeUserId,
      );

      if (pendingAuthRequestsForActiveUser) {
        this.messagingService.send("openLoginApproval");
      }
    }
  }

  setupUnlockListenersForProcessingAuthRequests(destroy$: Observable<void>): void {
    // When account switching to a user who is Unlocked, process any pending auth requests.
    this.accountService.activeAccount$
      .pipe(
        map((a) => a?.id), // Extract active userId
        distinctUntilChanged(), // Only when userId actually changes
        filter((userId) => userId != null), // Require a valid userId
        switchMap((userId) => this.authService.authStatusFor$(userId).pipe(take(1))), // Get current auth status once for new user
        filter((status) => status === AuthenticationStatus.Unlocked), // Only when the new user is Unlocked
        tap(() => {
          void this.processPendingAuthRequests();
        }),
        takeUntil(destroy$),
      )
      .subscribe();

    // When the active account transitions TO Unlocked, process any pending auth requests.
    this.authService.activeAccountStatus$
      .pipe(
        startWith(null as unknown as AuthenticationStatus), // Seed previous value to handle initial emission
        pairwise(), // Compare previous and current statuses
        filter(
          ([prev, curr]) =>
            prev !== AuthenticationStatus.Unlocked && curr === AuthenticationStatus.Unlocked, // Fire on transitions into Unlocked (incl. initial)
        ),
        takeUntil(destroy$),
      )
      .subscribe(() => {
        void this.processPendingAuthRequests();
      });
  }
}
