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

import { UserId } from "@bitwarden/user-core";

import { MasterPasswordServiceAbstraction } from "../../../key-management/master-password/abstractions/master-password.service.abstraction";
import { MessagingService } from "../../../platform/abstractions/messaging.service";
import { SystemNotificationEvent } from "../../../platform/system-notifications/system-notifications.service";
import { AccountService } from "../../abstractions/account.service";
import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "../../abstractions/auth.service";
import { AuthenticationStatus } from "../../enums/authentication-status";
import { ForceSetPasswordReason } from "../../models/domain/force-set-password-reason";
import { getOptionalUserId, getUserId } from "../account.service";

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

  async activeUserMeetsConditionsToShowApprovalDialog(authRequestUserId: UserId): Promise<boolean> {
    // If the active user is not the intended recipient of the auth request, return false
    const activeUserId: UserId | null = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId !== authRequestUserId) {
      return false;
    }

    // If the active user is not unlocked, return false
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    if (authStatus !== AuthenticationStatus.Unlocked) {
      return false;
    }

    // If the active user is required to set/change their master password, return false
    // Note that by this point we know that the authRequestUserId is the active UserId (see check above)
    const forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(authRequestUserId),
    );
    if (forceSetPasswordReason !== ForceSetPasswordReason.None) {
      return false;
    }

    // User meets conditions: they are the intended recipient, unlocked, and not required to set/change their master password
    return true;
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

  /**
   * Process notifications that have been received but didn't meet the conditions to display the
   * approval dialog.
   */
  private async processPendingAuthRequests(): Promise<void> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    // Only continue if the active user is not required to set/change their master password
    const forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(activeUserId),
    );
    if (forceSetPasswordReason !== ForceSetPasswordReason.None) {
      return;
    }

    // Prune any stale pending requests (older than 15 minutes)
    // This comes from GlobalSettings.cs
    //    public TimeSpan UserRequestExpiration { get; set; } = TimeSpan.FromMinutes(15);
    const fifteenMinutesMs = 15 * 60 * 1000;

    await this.pendingAuthRequestsState.pruneOlderThan(fifteenMinutesMs);

    const pendingAuthRequestsInState: PendingAuthUserMarker[] =
      (await firstValueFrom(this.pendingAuthRequestsState.getAll$())) ?? [];

    if (pendingAuthRequestsInState.length > 0) {
      const pendingAuthRequestsForActiveUser = pendingAuthRequestsInState.some(
        (e) => e.userId === activeUserId,
      );

      if (pendingAuthRequestsForActiveUser) {
        this.messagingService.send("openLoginApproval");
      }
    }
  }

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    throw new Error("handleAuthRequestNotificationClicked() not implemented for this client");
  }
}
