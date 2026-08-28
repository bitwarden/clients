import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map, Observable } from "rxjs";

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
