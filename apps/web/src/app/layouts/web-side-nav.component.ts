import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SideNavVariant, NavigationModule, SideNavService } from "@bitwarden/components";

import { UpgradeCalloutComponent } from "../billing/individual/upgrade/upgrade-nav-button/upgrade-callout/upgrade-callout.component";

import { AccountMenuComponent } from "./header/account-menu.component";
import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";
import { ProductSwitcherService } from "./product-switcher/shared/product-switcher.service";

@Component({
  selector: "app-side-nav",
  templateUrl: "web-side-nav.component.html",
  imports: [
    AccountMenuComponent,
    AsyncPipe,
    NavigationModule,
    ProductSwitcherModule,
    UpgradeCalloutComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebSideNavComponent {
  readonly variant = input<SideNavVariant>("primary");
  protected readonly sideNavService = inject(SideNavService);

  private readonly productSwitcherService = inject(ProductSwitcherService);

  protected readonly shouldShowPremiumUpgradeButton$ =
    this.productSwitcherService.shouldShowPremiumUpgradeButton$;

  /**
   * Whether the VFO1 Foundation flag is enabled. While it is off, the legacy header account menu
   * is shown instead (see `WebHeaderComponent`).
   */
  protected readonly vfo1FoundationEnabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );
}
