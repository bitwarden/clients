import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogoutService } from "@bitwarden/common/auth/logout";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { KeyConnectorApiService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector-api.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  AnonLayoutWrapperDataService,
  BitActionDirective,
  ButtonModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "confirm-key-connector-domain",
  templateUrl: "confirm-key-connector-domain.component.html",
  standalone: true,
  imports: [CommonModule, ButtonModule, I18nPipe, BitActionDirective, IconButtonModule],
})
export class ConfirmKeyConnectorDomainComponent implements OnInit {
  loading = true;
  keyConnectorUrl!: string;
  keyConnectorHostName!: string;
  organizationName: string | undefined;
  organizationSsoIdentifier!: string;
  userId!: UserId;

  /**
   * Runs after the conversion and before the navigation to the vault.
   *
   * @param organizationInviteAccepted Whether we told the server to accept the organization
   *   invite. `SsoJitProvisionFinishService.shouldAcceptOrganizationInvite` makes this decision.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() onBeforeNavigation: (organizationInviteAccepted: boolean) => Promise<void> =
    async () => {};

  constructor(
    private router: Router,
    private logService: LogService,
    private keyConnectorService: KeyConnectorService,
    private messagingService: MessagingService,
    private syncService: SyncService,
    private accountService: AccountService,
    private keyConnectorApiService: KeyConnectorApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private logoutService: LogoutService,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    try {
      this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    } catch {
      // No active account means we cannot call logoutService.logout(userId, reason). Send the
      // reason on the message payload so downstream consumers can surface it.
      this.logService.info("[confirm-key-connector-domain] no active account");
      this.messagingService.send("logout", { logoutReason: "keyConnectorError" });
      return;
    }

    const confirmation = await firstValueFrom(
      this.keyConnectorService.requiresDomainConfirmation$(this.userId),
    );
    if (confirmation == null) {
      this.logService.info("[confirm-key-connector-domain] missing required parameters");
      await this.logoutService.logout(this.userId, "keyConnectorError");
      return;
    }

    this.organizationSsoIdentifier = confirmation.organizationSsoIdentifier;
    this.organizationName = await this.getOrganizationName(confirmation.organizationSsoIdentifier);

    // PM-29133 Remove during cleanup.
    if (this.organizationName == undefined) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "verifyYourDomainToLogin" },
      });
    }

    this.keyConnectorUrl = confirmation.keyConnectorUrl;
    this.keyConnectorHostName = Utils.getHostname(confirmation.keyConnectorUrl);
    this.loading = false;
  }

  confirm = async () => {
    const autoEnrollStatus = await this.organizationApiService.getAutoEnrollStatus(
      this.organizationSsoIdentifier,
    );
    const organizationInviteAccepted =
      await this.keyConnectorService.convertNewSsoUserToKeyConnector(
        this.userId,
        autoEnrollStatus.id as OrganizationId,
      );

    if (this.organizationName) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("organizationVerified"),
      });
    } else {
      // PM-29133 Remove during cleanup.
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("domainVerified"),
      });
    }
    // We tell the server not to accept an open invite for this organization, so the organization
    // user stays Invited. Show the toast only when we told the server to accept the invite.
    if (organizationInviteAccepted) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("inviteAccepted"),
      });
    }

    await this.syncService.fullSync(true);

    this.messagingService.send("loggedIn");

    await this.onBeforeNavigation(organizationInviteAccepted);

    await this.router.navigate(["/"]);
  };

  cancel = async () => {
    await this.logoutService.logout(this.userId, "userInitiated");
  };

  private async getOrganizationName(
    organizationSsoIdentifier: string,
  ): Promise<string | undefined> {
    try {
      const details =
        await this.keyConnectorApiService.getConfirmationDetails(organizationSsoIdentifier);
      return details.organizationName;
    } catch (error) {
      // PM-29133 Remove during cleanup.
      // Old self hosted servers may not have this endpoint yet. On error log a warning and continue without organization name.
      this.logService.warning(
        `[ConfirmKeyConnectorDomainComponent] Unable to get key connector confirmation details for organizationSsoIdentifier ${organizationSsoIdentifier}:`,
        error,
      );
      return undefined;
    }
  }
}
