import { Component, input, InputSignal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map, Observable } from "rxjs";

import { User } from "@bitwarden/angular/pipes/user-name.pipe";
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
  readonly title: InputSignal<string | undefined> = input();

  /**
   * Icon to show before the title
   */
  readonly icon: InputSignal<string | undefined> = input();

  protected routeData$: Observable<{ titleId: string }>;
  protected account$: Observable<(User & { id: UserId }) | null>;
  protected canLock$: Observable<boolean>;
  protected selfHosted: boolean;
  protected hostname = location.hostname;

  constructor(
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private messagingService: MessagingService,
    private accountService: AccountService,
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

  protected logout() {
    this.messagingService.send("logout");
  }
}
