import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { map, Observable } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { DynamicAvatarComponent } from "../../components/dynamic-avatar.component";
import { SharedModule } from "../../shared";

@Component({
  selector: "app-account-menu",
  templateUrl: "./account-menu.component.html",
  imports: [SharedModule, DynamicAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountMenuComponent {
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly messagingService = inject(MessagingService);
  private readonly accountService = inject(AccountService);

  protected readonly account$: Observable<Account | null> = this.accountService.activeAccount$;
  protected readonly canLock$: Observable<boolean> = this.vaultTimeoutSettingsService
    .availableVaultTimeoutActions$()
    .pipe(map((actions) => actions.includes(VaultTimeoutAction.Lock)));
  protected readonly selfHosted = this.platformUtilsService.isSelfHost();
  protected readonly hostname = globalThis.location.hostname;

  protected lock() {
    this.messagingService.send("lockVault");
  }

  protected logout() {
    this.messagingService.send("logout");
  }
}
