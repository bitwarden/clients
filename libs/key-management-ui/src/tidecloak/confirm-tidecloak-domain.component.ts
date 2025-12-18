import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { KeyConnectorApiService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector-api.service";
import { TideCloakService } from "@bitwarden/common/key-management/tidecloak/abstractions/tidecloak.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AnonLayoutWrapperDataService,
  BitActionDirective,
  ButtonModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Component for confirming the TideCloak domain during new SSO user setup.
 * This is displayed when a user logs in via SSO for the first time and their
 * organization is configured to use TideCloak for key management.
 *
 * When confirmed, this triggers the TideCloak SDK to encrypt the user's
 * newly generated master key via SMPC and store it on the server.
 */
@Component({
  selector: "confirm-tidecloak-domain",
  templateUrl: "confirm-tidecloak-domain.component.html",
  standalone: true,
  imports: [CommonModule, ButtonModule, I18nPipe, BitActionDirective, IconButtonModule],
})
export class ConfirmTideCloakDomainComponent implements OnInit {
  loading = true;
  tideCloakUrl!: string;
  tideCloakHostName!: string;
  organizationName: string | undefined;
  userId!: UserId;

  @Input() onBeforeNavigation: () => Promise<void> = async () => {};

  constructor(
    private router: Router,
    private logService: LogService,
    private tideCloakService: TideCloakService,
    private messagingService: MessagingService,
    private syncService: SyncService,
    private accountService: AccountService,
    private keyConnectorApiService: KeyConnectorApiService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
  ) {}

  async ngOnInit() {
    try {
      this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    } catch {
      this.logService.info("[confirm-tidecloak-domain] no active account");
      this.messagingService.send("logout");
      return;
    }

    const confirmation = await firstValueFrom(
      this.tideCloakService.requiresDomainConfirmation$(this.userId),
    );
    if (confirmation == null) {
      this.logService.info("[confirm-tidecloak-domain] missing required parameters");
      this.messagingService.send("logout");
      return;
    }

    this.organizationName = await this.getOrganizationName(confirmation.organizationSsoIdentifier);

    if (this.organizationName == undefined) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "verifyYourTideCloakDomainToLogin" },
      });
    }

    this.tideCloakUrl = confirmation.tideCloakUrl;
    this.tideCloakHostName = Utils.getHostname(confirmation.tideCloakUrl);
    this.loading = false;
  }

  confirm = async () => {
    // This triggers the TideCloak SDK to:
    // 1. Generate a random password and derive a master key
    // 2. Encrypt the master key using SMPC via the TideCloak SDK
    // 3. Send the encrypted master key to the server for storage
    await this.tideCloakService.convertNewSsoUserToTideCloak(this.userId);

    if (this.organizationName) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("tideCloakOrganizationVerified"),
      });
    } else {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("tideCloakDomainVerified"),
      });
    }

    await this.syncService.fullSync(true);

    this.messagingService.send("loggedIn");

    await this.onBeforeNavigation();

    await this.router.navigate(["/"]);
  };

  cancel = async () => {
    this.messagingService.send("logout");
  };

  private async getOrganizationName(
    organizationSsoIdentifier: string,
  ): Promise<string | undefined> {
    try {
      // Reuse the key connector API service for getting organization details
      // since the endpoint is the same
      const details =
        await this.keyConnectorApiService.getConfirmationDetails(organizationSsoIdentifier);
      return details.organizationName;
    } catch (error) {
      this.logService.warning(
        `[ConfirmTideCloakDomainComponent] Unable to get confirmation details for organizationSsoIdentifier ${organizationSsoIdentifier}:`,
        error,
      );
      return undefined;
    }
  }
}
