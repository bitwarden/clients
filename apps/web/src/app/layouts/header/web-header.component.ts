import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map, Observable } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { BannerModule, HeaderComponent } from "@bitwarden/components";

import { DynamicAvatarComponent } from "../../components/dynamic-avatar.component";
import { SharedModule } from "../../shared";
import { ProductSwitcherModule } from "../product-switcher/product-switcher.module";

@Component({
  selector: "app-header",
  templateUrl: "./web-header.component.html",
  imports: [
    SharedModule,
    DynamicAvatarComponent,
    ProductSwitcherModule,
    BannerModule,
    HeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebHeaderComponent {
  private route = inject(ActivatedRoute);
  private platformUtilsService = inject(PlatformUtilsService);
  private vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private messagingService = inject(MessagingService);
  private accountService = inject(AccountService);

  /**
   * Custom title that overrides the route data `titleId`
   */
  readonly title = input<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<string>();

  protected routeData$: Observable<{ titleId: string }> = this.route.data.pipe(
    map((params) => {
      return {
        titleId: params.titleId,
      };
    }),
  );
  protected account$: Observable<Account | null> = this.accountService.activeAccount$;
  protected canLock$: Observable<boolean> = this.vaultTimeoutSettingsService
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
