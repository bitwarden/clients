import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { KeyConnectorApiService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector-api.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
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
  userId!: UserId;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() onBeforeNavigation: () => Promise<void> = async () => {};

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
  ) {}

  async ngOnInit() {
    try {
      this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    } catch {
      this.logService.info("[confirm-key-connector-domain] no active account");
      this.messagingService.send("logout");
      return;
    }

    const confirmation = await firstValueFrom(
      this.keyConnectorService.requiresDomainConfirmation$(this.userId),
    );
    if (confirmation == null) {
      this.logService.info("[confirm-key-connector-domain] missing required parameters");
      this.messagingService.send("logout");
      return;
    }

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
    await this.keyConnectorService.convertNewSsoUserToKeyConnector(this.userId);

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
