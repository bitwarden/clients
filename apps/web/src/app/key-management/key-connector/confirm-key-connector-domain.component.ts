import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { AsyncActionsModule, ButtonModule } from "@bitwarden/components";
import { ConfirmKeyConnectorDomainComponent as BaseConfirmKeyConnectorDomainComponent } from "@bitwarden/key-management-ui";
import { RouterService } from "@bitwarden/web-vault/app/core";

@Component({
  selector: "app-confirm-key-connector-domain",
  templateUrl: "confirm-key-connector-domain.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, ButtonModule, AsyncActionsModule, RouterModule],
})
export class ConfirmKeyConnectorDomainComponent extends BaseConfirmKeyConnectorDomainComponent {
  constructor(
    router: Router,
    logService: LogService,
    keyConnectorService: KeyConnectorService,
    messagingService: MessagingService,
    syncService: SyncService,
    accountService: AccountService,
    private routerService: RouterService,
  ) {
    super(router, logService, keyConnectorService, messagingService, syncService, accountService);
  }

  override async beforeNavigationConfirmCallback() {
    await this.routerService.getAndClearLoginRedirectUrl();
  }
}
