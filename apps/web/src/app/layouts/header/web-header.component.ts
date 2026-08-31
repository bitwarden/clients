import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BannerModule, BitwardenIcon, HeaderComponent, HeaderContext } from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";

import { SharedModule } from "../../shared";
import { ProductSwitcherModule } from "../product-switcher/product-switcher.module";

import { AccountMenuComponent } from "./account-menu.component";

@Component({
  selector: "app-header",
  templateUrl: "./web-header.component.html",
  imports: [
    SharedModule,
    ProductSwitcherModule,
    BannerModule,
    HeaderComponent,
    AccountMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /**
   * Required to provide one HeaderContext instance to both the `bit-breadrumbs` declared in this
   * template and the `bit-header`
   */
  providers: [safeProvider(HeaderContext)],
})
export class WebHeaderComponent {
  private readonly route = inject(ActivatedRoute);

  /**
   * Whether the legacy header account menu should render. It's hidden once the VFO1 side-nav
   * footer account menu (see `WebSideNavComponent`) takes over.
   */
  protected readonly showAccountMenu = toSignal(
    inject(ConfigService)
      .getFeatureFlag$(FeatureFlag.VFO1Foundation)
      .pipe(map((enabled) => !enabled)),
    { initialValue: true },
  );

  /**
   * Custom title that overrides the route data `titleId`
   */
  readonly title = input<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<BitwardenIcon>();

  protected readonly routeData$: Observable<{ titleId: string }> = this.route.data.pipe(
    map((params) => {
      return {
        titleId: params.titleId,
      };
    }),
  );
}
