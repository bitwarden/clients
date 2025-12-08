import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { BitActionDirective, ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "confirm-key-connector-domain",
  templateUrl: "confirm-key-connector-domain.component.html",
  standalone: true,
  imports: [CommonModule, ButtonModule, I18nPipe, BitActionDirective],
})
export class ConfirmKeyConnectorDomainComponent implements OnInit {
  loading = true;
  keyConnectorUrl!: string;
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

    this.keyConnectorUrl = confirmation.keyConnectorUrl;

    this.loading = false;
  }

  confirm = async () => {
    await this.keyConnectorService.convertNewSsoUserToKeyConnector(this.userId);

    await this.syncService.fullSync(true);

    this.messagingService.send("loggedIn");

    await this.onBeforeNavigation();

    await this.router.navigate(["/"]);
  };

  cancel = async () => {
    this.messagingService.send("logout");
  };
}
