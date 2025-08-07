import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import {
  ButtonLocation,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "@bitwarden/common/platform/notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringServiceAbstraction } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

export class AuthRequestAnsweringService implements AuthRequestAnsweringServiceAbstraction {
  constructor(
    private readonly accountService: AccountService,
    private readonly actionService: ActionsService,
    private readonly authService: AuthService,
    private readonly masterPasswordService: MasterPasswordServiceAbstraction,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly systemNotificationsService: SystemNotificationsService,
  ) {}

  async handleAuthRequestNotificationClicked(event: SystemNotificationEvent): Promise<void> {
    if (event.buttonIdentifier === ButtonLocation.NotificationButton) {
      // await this.systemNotificationsService.clear({
      //   id: `authRequest_${event.id}`,
      // });
      await this.actionService.openPopup();
    }
  }

  async receivedPendingAuthRequest(userId: UserId, authRequestId: string): Promise<void> {
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(userId),
    );

    // Is the popup already open?
    if (
      (await this.platformUtilsService.isPopupOpen()) &&
      authStatus === AuthenticationStatus.Unlocked &&
      activeUserId === userId &&
      forceSetPasswordReason === ForceSetPasswordReason.None
    ) {
      // TODO: Handled in 14934
    } else {
      await this.systemNotificationsService.create({
        id: `authRequest_${authRequestId}`,
        title: "Test (i18n)",
        body: "Pending Auth Request to Approve (i18n)",
        buttons: [],
      });
    }
  }
}
