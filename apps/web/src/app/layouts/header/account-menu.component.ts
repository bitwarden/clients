import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, Observable } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
  private readonly accountService = inject(AccountService);
  private readonly logoutService = inject(LogoutService);
  private readonly messagingService = inject(MessagingService);

  protected readonly account = toSignal(this.accountService.activeAccount$);

  protected readonly canLock$: Observable<boolean> = this.vaultTimeoutSettingsService
    .availableVaultTimeoutActions$()
    .pipe(map((actions) => actions.includes(VaultTimeoutAction.Lock)));
  protected readonly selfHosted = this.platformUtilsService.isSelfHost();
  protected readonly hostname = globalThis.location.hostname;

  protected lock() {
    // Route through the "lockVault" message handler in AppComponent so that
    // canDeactivate guards (e.g. unsaved policy edits) are consulted before
    // any vault state is cleared — mirroring how logout works via LogoutService.
    this.messagingService.send("lockVault");
  }

  protected async logout() {
    const userId = this.account()?.id;
    if (userId) {
      await this.logoutService.logout(userId);
    }
  }
}
