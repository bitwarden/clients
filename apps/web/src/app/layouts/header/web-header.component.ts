// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map, Observable } from "rxjs";

import { User } from "@bitwarden/angular/pipes/user-name.pipe";
import { LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-header",
  templateUrl: "./web-header.component.html",
  standalone: false,
})
export class WebHeaderComponent {
  /**
   * Custom title that overrides the route data `titleId`
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() title: string;

  /**
   * Icon to show before the title
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() icon: string;

  protected routeData$: Observable<{ titleId: string }>;
  protected account$: Observable<User & { id: UserId }>;
  protected canLock$: Observable<boolean>;
  protected selfHosted: boolean;
  protected hostname = location.hostname;

  constructor(
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private messagingService: MessagingService,
    private accountService: AccountService,
    private logoutService: LogoutService,
  ) {
    this.routeData$ = this.route.data.pipe(
      map((params) => {
        return {
          titleId: params.titleId,
        };
      }),
    );

    this.selfHosted = this.platformUtilsService.isSelfHost();

    this.account$ = this.accountService.activeAccount$;
    this.canLock$ = this.vaultTimeoutSettingsService
      .availableVaultTimeoutActions$()
      .pipe(map((actions) => actions.includes(VaultTimeoutAction.Lock)));
  }

  protected lock() {
    this.messagingService.send("lockVault");
  }

  protected async logout() {
    const account = await firstValueFrom(this.account$);
    if (account?.id) {
      await this.logoutService.logout(account.id, "userInitiated");
    }
  }
}
