import { SystemNotificationEvent } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

export abstract class AuthRequestAnsweringService {
  /**
   * Tries to either display the dialog for the user or will preserve its data and show it at a
   * later time. Even in the event the dialog is shown immediately, this will write to global state
   * so that even if someone closes a window or a popup and comes back, it could be processed later.
   * Only way to clear out the global state is to respond to the auth request.
   *
   * Currently, this is only implemented for browser extension.
   *
   * @param userId The UserId that the auth request is for.
   * @param authRequestId The id of the auth request that is to be processed.
   */
  abstract receivedPendingAuthRequest(userId: UserId, authRequestId?: string): Promise<void>;

  /**
   * Confirms whether or not the user meets the conditions required to show an approval
   * dialog immediately. Those conditions are:
   * - User must be Unlocked
   * - User must be the active user
   * - User must not be required to set/change their password
   *
   * @param userId the UserId that the auth request is for.
   * @returns boolean stating whether or not the user meets conditions necessary to show
   *          an approval dialog immediately.
   */
  abstract userMeetsConditionsToShowApprovalDialog(userId: UserId): Promise<boolean>;

  /**
   * When a system notification is clicked, this function is used to process that event.
   * - Implemented in Extension only
   *
   * @param event The event passed in. Check initNotificationSubscriptions in main.background.ts.
   */
  abstract handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void>;

  /**
   * Process notifications that have been received but didn't meet the conditions to display the
   * approval dialog.
   */
  abstract processPendingAuthRequests(): Promise<void>;
}
