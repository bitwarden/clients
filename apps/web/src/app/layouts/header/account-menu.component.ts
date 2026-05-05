import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, Observable } from "rxjs";

import { LockService, LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
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
  private readonly lockService = inject(LockService);

  protected readonly account = toSignal(this.accountService.activeAccount$);

  protected readonly canLock$: Observable<boolean> = this.vaultTimeoutSettingsService
    .availableVaultTimeoutActions$()
    .pipe(map((actions) => actions.includes(VaultTimeoutAction.Lock)));
  protected readonly selfHosted = this.platformUtilsService.isSelfHost();
  protected readonly hostname = globalThis.location.hostname;

  protected async lock() {
    const userId = this.account()?.id;
    if (userId) {
      await this.lockService.lock(userId);
    }
  }

  protected async logout() {
    const userId = this.account()?.id;
    if (userId) {
      await this.logoutService.logout(userId);
    }
  }
}
